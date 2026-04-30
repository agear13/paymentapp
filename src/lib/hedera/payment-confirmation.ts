/**
 * Hedera Payment Confirmation Handler
 * Processes confirmed Hedera payments and posts to ledger
 * 
 * Sprint 24: Enhanced with comprehensive edge case handling
 */

import { prisma } from '@/lib/server/prisma';
import { log } from '@/lib/logger';
import type { TokenType } from './constants';
import type { PaymentToken } from '@prisma/client';
import { postHederaSettlement } from '@/lib/ledger/posting-rules/hedera';
import { invoiceDenominationCurrency } from '@/lib/payments/invoice-denomination';
import { validatePostingBalance } from '@/lib/ledger/balance-validation';
import {
  checkDuplicatePayment,
  validatePaymentAttempt,
  acquirePaymentLock,
  releasePaymentLock,
} from '@/lib/payment/edge-case-handler';
import { generateCorrelationId } from '@/lib/services/correlation';
import { normalizeHederaTransactionId } from './txid';

/**
 * Parameters for confirming a Hedera payment
 */
export interface ConfirmHederaPaymentParams {
  paymentLinkId: string;
  transactionId: string;
  tokenType: TokenType;
  amountReceived: string; // Crypto amount received (with decimals)
  sender: string; // Hedera account ID of sender
  memo?: string;
}

/**
 * Confirm a Hedera payment and post to ledger
 * 
 * This function should be called when:
 * 1. A transaction is detected on the Hedera network
 * 2. The transaction has been validated
 * 3. The amount is sufficient
 * 
 * Steps:
 * 1. Update payment link status to PAID
 * 2. Create PAYMENT_CONFIRMED event
 * 3. Get FX snapshot for settlement
 * 4. Post to ledger
 * 5. Validate balance
 * 
 * @param params - Payment confirmation parameters
 * @returns Promise<void>
 * @throws Error if confirmation fails
 */
export async function confirmHederaPayment(
  params: ConfirmHederaPaymentParams
): Promise<void> {
  const {
    paymentLinkId,
    transactionId,
    tokenType,
    amountReceived,
    sender,
    memo,
  } = params;

  // Normalize transaction ID to canonical dash format for consistent storage
  const normalizedTxId = normalizeHederaTransactionId(transactionId);
  
  // Generate correlation ID from normalized transaction ID
  const correlationId = generateCorrelationId('hedera', normalizedTxId);

  log.info('Processing Hedera payment confirmation', {
    paymentLinkId,
    transactionId,
    normalizedTxId,
    tokenType,
    amountReceived,
    correlationId,
  });

  // Sprint 24: Check for duplicate payment FIRST
  const duplicateCheck = await checkDuplicatePayment(
    paymentLinkId,
    transactionId,
    'HEDERA'
  );

  if (duplicateCheck.isDuplicate) {
    log.warn('Duplicate payment detected - skipping', {
      paymentLinkId,
      transactionId,
      correlationId,
      existingEventId: duplicateCheck.existingPaymentEventId,
    });
    return; // Already processed
  }

  // Sprint 24: Validate payment attempt and acquire lock to prevent race conditions
  const attemptValidation = await validatePaymentAttempt(paymentLinkId, false);
  
  if (!attemptValidation.allowed) {
    log.warn('Payment attempt not allowed', {
      paymentLinkId,
      reason: attemptValidation.reason,
      status: attemptValidation.currentStatus,
    });
    throw new Error(attemptValidation.reason || 'Payment not allowed');
  }

  // Sprint 24: Acquire advisory lock for processing
  const lockAcquired = await acquirePaymentLock(paymentLinkId);
  
  if (!lockAcquired) {
    log.warn(
      'Could not acquire payment lock - another process may be handling',
      { paymentLinkId }
    );
    throw new Error('Payment is being processed by another request');
  }

  try {
    // Get payment link
    const paymentLink = await prisma.payment_links.findUnique({
      where: { id: paymentLinkId },
      select: {
        id: true,
        organization_id: true,
        amount: true,
        currency: true,
        invoice_currency: true,
        status: true,
      },
    });

    if (!paymentLink) {
      throw new Error(`Payment link not found: ${paymentLinkId}`);
    }

    const invoiceCcy = invoiceDenominationCurrency(paymentLink);

    // Double-check status (in case changed since validation)
    if (paymentLink.status === 'PAID') {
      log.info('Payment link already marked as PAID', { paymentLinkId });
      return; // Already processed
    }

    // Determine network from environment
    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
    const mirrorUrl = network === 'mainnet'
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';

    // Update payment link and create event in transaction
    await prisma.$transaction([
    // Update payment link status
    prisma.payment_links.update({
      where: { id: paymentLinkId },
      data: { status: 'PAID', updated_at: new Date() },
    }),
    // Create payment event
    prisma.payment_events.create({
      data: {
        payment_link_id: paymentLinkId,
        event_type: 'PAYMENT_CONFIRMED',
        payment_method: 'HEDERA',
        hedera_transaction_id: normalizedTxId,
        amount_received: amountReceived,
        currency_received: tokenType,
        correlation_id: correlationId,
        metadata: {
          raw_transaction_id: transactionId,
          normalized_transaction_id: normalizedTxId,
          tokenType,
          token_type: tokenType,
          sender,
          payer_account_id: sender,
          memo,
          confirmedAt: new Date().toISOString(),
          network,
          mirror_url: mirrorUrl,
        },
      },
    }),
    ]);

      log.info('Payment link updated to PAID status', {
        paymentLinkId,
        transactionId,
        correlationId,
        tokenType,
      });

    // Same as Stripe path: queue Xero PAYMENT sync on confirmation (do not tie to ledger posting success).
    const { queueXeroPaymentSyncIfEnabled } = await import('@/lib/xero/queue-service');
    await queueXeroPaymentSyncIfEnabled({
      paymentLinkId,
      organizationId: paymentLink.organization_id,
      source: 'confirm-hedera-payment',
    });

    // Get FX snapshot for settlement
    const fxSnapshot = await prisma.fx_snapshots.findFirst({
    where: {
      payment_link_id: paymentLinkId,
      snapshot_type: 'SETTLEMENT',
      token_type: tokenType as PaymentToken,
    },
      orderBy: { captured_at: 'desc' },
    });

    if (!fxSnapshot) {
      log.error('FX snapshot not found for settlement', undefined, {
        paymentLinkId,
        tokenType,
      });
      throw new Error('FX snapshot not found - cannot post to ledger');
    }

    // Post to ledger
    try {
      await postHederaSettlement({
      paymentLinkId,
      organizationId: paymentLink.organization_id,
      tokenType,
      cryptoAmount: amountReceived,
      invoiceAmount: paymentLink.amount.toString(),
      invoiceCurrency: invoiceCcy,
      fxRate: typeof fxSnapshot.rate === 'number'
        ? fxSnapshot.rate
        : parseFloat(fxSnapshot.rate.toString()),
      transactionId,
      correlationId,
      idempotencyKey: correlationId, // Use correlation_id for idempotency
      });

      // Validate balance
      await validatePostingBalance(paymentLinkId);

      log.info('Hedera settlement posted to ledger successfully', {
        paymentLinkId,
        transactionId,
        correlationId,
        tokenType,
        invoiceAmount: paymentLink.amount.toString(),
        currency: invoiceCcy,
      });
    } catch (error: any) {
      log.error(
        'Failed to post Hedera settlement to ledger',
        error,
        { paymentLinkId, transactionId }
      );
      
      // Don't throw - payment is still confirmed
      // We can retry ledger posting later if needed
    }
  } finally {
    // Sprint 24: Always release the lock
    await releasePaymentLock(paymentLinkId);
  }
}

/**
 * Batch confirm multiple Hedera payments
 * Useful for processing pending payments
 * 
 * @param payments - Array of payment confirmation parameters
 * @returns Array of results (success/failure for each)
 */
export async function batchConfirmHederaPayments(
  payments: ConfirmHederaPaymentParams[]
): Promise<Array<{ paymentLinkId: string; success: boolean; error?: string }>> {
  const results: Array<{
    paymentLinkId: string;
    success: boolean;
    error?: string;
  }> = [];

  for (const payment of payments) {
    try {
      await confirmHederaPayment(payment);
      results.push({ paymentLinkId: payment.paymentLinkId, success: true });
    } catch (error: any) {
      results.push({
        paymentLinkId: payment.paymentLinkId,
        success: false,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Check if a payment link has ledger entries
 * Useful for determining if ledger posting needs to be retried
 * 
 * @param paymentLinkId - Payment link ID
 * @returns True if ledger entries exist
 */
export async function hasLedgerEntries(paymentLinkId: string): Promise<boolean> {
  const count = await prisma.ledger_entries.count({
    where: { payment_link_id: paymentLinkId },
  });
  
  return count > 0;
}

/**
 * Retry ledger posting for a payment that was confirmed but not posted
 * 
 * @param paymentLinkId - Payment link ID
 * @returns Promise<void>
 * @throws Error if retry fails
 */
export async function retryLedgerPosting(paymentLinkId: string): Promise<void> {
  log.info('Retrying ledger posting', { paymentLinkId });

  // Check if already has ledger entries
  if (await hasLedgerEntries(paymentLinkId)) {
    log.info('Ledger entries already exist', { paymentLinkId });
    return;
  }

  // Get payment link and event
  const paymentLink = await prisma.payment_links.findUnique({
    where: { id: paymentLinkId },
    include: {
      payment_events: {
        where: {
          event_type: 'PAYMENT_CONFIRMED',
          payment_method: 'HEDERA',
        },
        orderBy: { created_at: 'desc' },
        take: 1,
      },
    },
  });

  if (!paymentLink || paymentLink.payment_events.length === 0) {
    throw new Error('Payment link or payment event not found');
  }

  const paymentEvent = paymentLink.payment_events[0];
  const metadata = paymentEvent.metadata as any;

  if (!paymentEvent.hedera_transaction_id || !metadata.tokenType) {
    throw new Error('Missing required payment event data');
  }

  // Get FX snapshot
  const fxSnapshot = await prisma.fx_snapshots.findFirst({
    where: {
      payment_link_id: paymentLinkId,
      snapshot_type: 'SETTLEMENT',
      token_type: metadata.tokenType,
    },
    orderBy: { captured_at: 'desc' },
  });

  if (!fxSnapshot) {
    throw new Error('FX snapshot not found');
  }

  // Post to ledger
  await postHederaSettlement({
    paymentLinkId,
    organizationId: paymentLink.organization_id,
    tokenType: metadata.tokenType,
    cryptoAmount: paymentEvent.amount_received?.toString() || '0',
    invoiceAmount: paymentLink.amount.toString(),
    invoiceCurrency: invoiceDenominationCurrency(paymentLink),
    fxRate: typeof fxSnapshot.rate === 'number'
      ? fxSnapshot.rate
      : parseFloat(fxSnapshot.rate.toString()),
    transactionId: paymentEvent.hedera_transaction_id,
  });

  // Validate balance
  await validatePostingBalance(paymentLinkId);

  log.info('Ledger posting retry successful', { paymentLinkId });
}

