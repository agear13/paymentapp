/**
 * Unified Payment Confirmation Service
 * Handles payment confirmation pipeline for both Stripe and Hedera
 * Ensures idempotency and atomicity
 */

import { prisma } from '@/lib/server/prisma';
import { log } from '@/lib/logger';
import { generateCorrelationId } from './correlation';
import { postStripeSettlement } from '@/lib/ledger/posting-rules/stripe';
import { postHederaSettlement } from '@/lib/ledger/posting-rules/hedera';
import { validatePostingBalance } from '@/lib/ledger/balance-validation';
import config from '@/lib/config/env';
import { normalizeHederaTransactionId } from '@/lib/hedera/txid';

export interface ConfirmPaymentParams {
  paymentLinkId: string;
  provider: 'stripe' | 'hedera';
  providerRef: string; // Stripe event_id or Hedera tx_id
  paymentIntentId?: string; // For Stripe
  checkoutSessionId?: string; // For Stripe
  transactionId?: string; // For Hedera
  amountReceived: number;
  currencyReceived: string;
  metadata?: Record<string, any>;
  correlationId?: string;
  // Hedera-specific
  tokenType?: 'HBAR' | 'USDC' | 'USDT' | 'AUDD';
  fxRate?: number;
}

export interface ConfirmPaymentResult {
  success: boolean;
  paymentEventId?: string;
  alreadyProcessed?: boolean;
  error?: string;
}

/**
 * Main payment confirmation function
 * Handles the complete pipeline atomically with idempotency
 */
export async function confirmPayment(
  params: ConfirmPaymentParams
): Promise<ConfirmPaymentResult> {
  const {
    paymentLinkId,
    provider,
    providerRef,
    paymentIntentId,
    checkoutSessionId,
    transactionId,
    amountReceived,
    currencyReceived,
    metadata = {},
    tokenType,
    fxRate,
  } = params;

  // Normalize Hedera transaction ID for consistent storage
  const normalizedProviderRef = provider === 'hedera' 
    ? normalizeHederaTransactionId(providerRef)
    : providerRef;

  // Generate or use provided correlation ID (from normalized ref)
  const correlationId = params.correlationId || 
    generateCorrelationId(provider, normalizedProviderRef);

  log.info({
    correlationId,
    paymentLinkId,
    provider,
    providerRef,
    normalizedProviderRef: provider === 'hedera' ? normalizedProviderRef : undefined,
    amountReceived,
    currencyReceived,
  }, 'Starting payment confirmation');

  try {
    // Check idempotency based on provider (check both formats for Hedera)
    const idempotencyCheck = provider === 'stripe'
      ? await checkStripeIdempotency(providerRef)
      : await checkHederaIdempotency(normalizedProviderRef, providerRef);

    if (idempotencyCheck.exists) {
      log.info({
        correlationId,
        existingEventId: idempotencyCheck.eventId,
      }, 'Payment already processed (idempotent)');
      
      return {
        success: true,
        alreadyProcessed: true,
        paymentEventId: idempotencyCheck.eventId,
      };
    }

    // Execute confirmation pipeline in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get and validate payment link
      const paymentLink = await tx.payment_links.findUnique({
        where: { id: paymentLinkId },
      });

      if (!paymentLink) {
        throw new Error(`Payment link ${paymentLinkId} not found`);
      }

      if (paymentLink.status === 'PAID') {
        log.warn({
          correlationId,
          paymentLinkId,
          status: paymentLink.status,
        }, 'Payment link already paid');
        
        // Find existing event
        const existingEvent = await tx.payment_events.findFirst({
          where: {
            payment_link_id: paymentLinkId,
            event_type: 'PAYMENT_CONFIRMED',
          },
        });

        return {
          success: true,
          alreadyProcessed: true,
          paymentEventId: existingEvent?.id,
        };
      }

      if (paymentLink.status !== 'OPEN') {
        throw new Error(
          `Payment link status is ${paymentLink.status}, expected OPEN`
        );
      }

      // 2. Update payment link to PAID
      await tx.payment_links.update({
        where: { id: paymentLinkId },
        data: {
          status: 'PAID',
          paid_at: new Date(),
          updated_at: new Date(),
        },
      });

      // 3. Create payment event with idempotency fields
      const paymentEventData: any = {
        payment_link_id: paymentLinkId,
        event_type: 'PAYMENT_CONFIRMED',
        payment_method: provider.toUpperCase(),
        amount_received: amountReceived,
        currency_received: currencyReceived,
        correlation_id: correlationId,
        metadata: {
          ...metadata,
          ...(provider === 'hedera' && tokenType && {
            token_type: tokenType,
            consensus_timestamp: metadata?.consensus_timestamp,
            network: metadata?.network,
            payer_account_id: metadata?.sender,
            merchant_account_id: metadata?.recipient,
            mirror_url: metadata?.mirror_url,
          }),
        },
        created_at: new Date(),
      };

      // Add provider-specific fields
      if (provider === 'stripe') {
        paymentEventData.stripe_event_id = providerRef;
        paymentEventData.stripe_payment_intent_id = paymentIntentId;
        paymentEventData.stripe_checkout_session_id = checkoutSessionId;
      } else if (provider === 'hedera') {
        paymentEventData.hedera_transaction_id = normalizedProviderRef;
        // Add raw and normalized IDs to metadata
        paymentEventData.metadata = {
          ...paymentEventData.metadata,
          raw_transaction_id: providerRef,
          normalized_transaction_id: normalizedProviderRef,
        };
      }

      const paymentEvent = await tx.payment_events.create({
        data: paymentEventData,
      });

      log.info({
        correlationId,
        paymentEventId: paymentEvent.id,
        paymentLinkId,
      }, 'Payment event created');

      // 4. Post to ledger with idempotency
      try {
        if (provider === 'stripe') {
          await postStripeSettlement({
            paymentLinkId,
            organizationId: paymentLink.organization_id,
            stripeAmount: amountReceived,
            invoiceAmount: paymentLink.amount.toString(),
            invoiceCurrency: paymentLink.currency,
            paymentIntentId: paymentIntentId || providerRef,
            feeAmount: 0, // Calculate if needed
            correlationId,
            idempotencyKey: correlationId, // Use correlation_id for idempotency
          });
        } else if (provider === 'hedera' && tokenType) {
          // Get FX snapshot for settlement
          const fxSnapshot = await tx.fx_snapshots.findFirst({
            where: {
              payment_link_id: paymentLinkId,
              snapshot_type: 'SETTLEMENT',
              token_type: tokenType,
            },
            orderBy: { captured_at: 'desc' },
          });

          if (!fxSnapshot) {
            throw new Error(
              `FX snapshot not found for ${tokenType} settlement`
            );
          }

          const rate = fxRate || 
            (typeof fxSnapshot.rate === 'number' 
              ? fxSnapshot.rate 
              : parseFloat(fxSnapshot.rate.toString()));

          await postHederaSettlement({
            paymentLinkId,
            organizationId: paymentLink.organization_id,
            tokenType,
            cryptoAmount: amountReceived,
            invoiceAmount: paymentLink.amount.toString(),
            invoiceCurrency: paymentLink.currency,
            fxRate: rate,
            transactionId: transactionId || providerRef,
            correlationId,
            idempotencyKey: correlationId, // Use correlation_id for idempotency
          });
        }

        // Validate ledger balance
        await validatePostingBalance(paymentLinkId);

        log.info({
          correlationId,
          paymentLinkId,
        }, 'Ledger entries posted and validated');
      } catch (ledgerError: any) {
        log.error({
          correlationId,
          error: ledgerError.message,
        }, 'Ledger posting failed');
        throw ledgerError;
      }

      // 5. Queue Xero sync if enabled
      if (config.features.xeroSync) {
        try {
          await tx.xero_syncs.create({
            data: {
              id: crypto.randomUUID(),
              payment_link_id: paymentLinkId,
              sync_type: 'INVOICE',
              status: 'PENDING',
              request_payload: {
                paymentLinkId,
                organizationId: paymentLink.organization_id,
                correlationId,
                queuedBy: 'payment-confirmation',
                queuedAt: new Date().toISOString(),
              },
              retry_count: 0,
              next_retry_at: new Date(),
              created_at: new Date(),
              updated_at: new Date(),
            },
          });

          log.info({
            correlationId,
            paymentLinkId,
          }, 'Xero sync queued');
        } catch (xeroError: any) {
          // Don't fail payment if Xero sync fails
          log.error({
            correlationId,
            error: xeroError.message,
          }, 'Xero sync queue failed (non-blocking)');
        }
      }

      return {
        success: true,
        paymentEventId: paymentEvent.id,
        alreadyProcessed: false,
      };
    });

    log.info({
      correlationId,
      paymentEventId: result.paymentEventId,
    }, 'Payment confirmation completed successfully');

    return result;
  } catch (error: any) {
    log.error({
      correlationId,
      error: error.message,
      stack: error.stack,
    }, 'Payment confirmation failed');

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Check if Stripe payment already processed
 */
async function checkStripeIdempotency(eventId: string) {
  const existing = await prisma.payment_events.findFirst({
    where: {
      stripe_event_id: eventId,
    },
  });

  return {
    exists: !!existing,
    eventId: existing?.id,
  };
}

/**
 * Check if Hedera payment already processed
 * Checks both normalized and raw formats for backwards compatibility
 */
async function checkHederaIdempotency(normalizedTxId: string, rawTxId?: string) {
  const existing = await prisma.payment_events.findFirst({
    where: {
      OR: [
        { hedera_transaction_id: normalizedTxId },
        ...(rawTxId && rawTxId !== normalizedTxId ? [
          { hedera_transaction_id: rawTxId },
        ] : []),
      ],
    },
  });

  return {
    exists: !!existing,
    eventId: existing?.id,
  };
}

