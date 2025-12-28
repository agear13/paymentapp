/**
 * Hedera Payment Confirmation Handler
 * Processes confirmed Hedera payments and posts to ledger
 * 
 * Sprint 24: Enhanced with comprehensive edge case handling
 */

import { prisma } from '@/lib/prisma';
import { log } from '@/lib/logger';
import type { TokenType } from './constants';
import type { PaymentToken } from '@prisma/client';
import {
  postHederaSettlement,
  buildHederaSettlementParams,
} from '@/lib/ledger/posting-rules/hedera';
import { validatePostingBalance } from '@/lib/ledger/balance-validation';
import {
  checkDuplicatePayment,
  validatePaymentAttempt,
  acquirePaymentLock,
  releasePaymentLock,
} from '@/lib/payment/edge-case-handler';

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

  log.info(
    {
      paymentLinkId,
      transactionId,
      tokenType,
      amountReceived,
    },
    'Processing Hedera payment confirmation'
  );

  // Sprint 24: Check for duplicate payment FIRST
  const duplicateCheck = await checkDuplicatePayment(
    paymentLinkId,
    transactionId,
    'HEDERA'
  );

  if (duplicateCheck.isDuplicate) {
    log.warn(
      {
        paymentLinkId,
        transactionId,
        existingEventId: duplicateCheck.existingPaymentEventId,
      },
      'Duplicate payment detected - skipping'
    );
    return; // Already processed
  }

  // Sprint 24: Validate payment attempt and acquire lock to prevent race conditions
  const attemptValidation = await validatePaymentAttempt(paymentLinkId, false);
  
  if (!attemptValidation.allowed) {
    log.warn(
      {
        paymentLinkId,
        reason: attemptValidation.reason,
        status: attemptValidation.currentStatus,
      },
      'Payment attempt not allowed'
    );
    throw new Error(attemptValidation.reason || 'Payment not allowed');
  }

  // Sprint 24: Acquire advisory lock for processing
  const lockAcquired = await acquirePaymentLock(paymentLinkId);
  
  if (!lockAcquired) {
    log.warn({ paymentLinkId }, 'Could not acquire payment lock - another process may be handling');
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
        status: true,
      },
    });

    if (!paymentLink) {
      throw new Error(`Payment link not found: ${paymentLinkId}`);
    }

    // Double-check status (in case changed since validation)
    if (paymentLink.status === 'PAID') {
      log.info({ paymentLinkId }, 'Payment link already marked as PAID');
      return; // Already processed
    }

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
        hedera_transaction_id: transactionId,
        amount_received: amountReceived,
        currency_received: paymentLink.currency, // Invoice currency
        metadata: {
          tokenType,
          sender,
          memo,
          confirmedAt: new Date().toISOString(),
        },
      },
    }),
    ]);

    log.info(
      {
        paymentLinkId,
        transactionId,
        tokenType,
      },
      'Payment link updated to PAID status'
    );

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
      log.error(
        { paymentLinkId, tokenType },
        'FX snapshot not found for settlement'
      );
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
      invoiceCurrency: paymentLink.currency,
      fxRate: typeof fxSnapshot.rate === 'number'
        ? fxSnapshot.rate
        : parseFloat(fxSnapshot.rate.toString()),
      transactionId,
      });

      // Validate balance
      await validatePostingBalance(paymentLinkId);

      log.info(
        {
          paymentLinkId,
          transactionId,
          tokenType,
          invoiceAmount: paymentLink.amount.toString(),
          currency: paymentLink.currency,
        },
        'Hedera settlement posted to ledger successfully'
      );

      // Queue Xero sync (Sprint 13)
      try {
        const { queueXeroSync } = await import('@/lib/xero/queue-service');
        await queueXeroSync({
          paymentLinkId,
          organizationId: paymentLink.organization_id,
        });
        log.info({ paymentLinkId }, 'Xero sync queued successfully');
      } catch (queueError: any) {
        log.error(
          {
            paymentLinkId,
            error: queueError.message,
          },
          'Failed to queue Xero sync - will retry later'
        );
        // Don't throw - payment is confirmed, sync can be retried manually
      }
    } catch (error: any) {
      log.error(
        {
          paymentLinkId,
          transactionId,
          error: error.message,
        },
        'Failed to post Hedera settlement to ledger'
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
  log.info({ paymentLinkId }, 'Retrying ledger posting');

  // Check if already has ledger entries
  if (await hasLedgerEntries(paymentLinkId)) {
    log.info({ paymentLinkId }, 'Ledger entries already exist');
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
    invoiceCurrency: paymentLink.currency,
    fxRate: typeof fxSnapshot.rate === 'number'
      ? fxSnapshot.rate
      : parseFloat(fxSnapshot.rate.toString()),
    transactionId: paymentEvent.hedera_transaction_id,
  });

  // Validate balance
  await validatePostingBalance(paymentLinkId);

  log.info({ paymentLinkId }, 'Ledger posting retry successful');
}

