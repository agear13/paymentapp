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
import { postWiseSettlement } from '@/lib/ledger/posting-rules/wise';
import { validatePostingBalance } from '@/lib/ledger/balance-validation';
import config from '@/lib/config/env';
import { normalizeHederaTransactionId } from '@/lib/hedera/txid';
import { createReferralConversionFromPaymentConfirmed } from '@/lib/referrals/payment-conversion';
import { assertPaymentLinksUpdateDataValid } from '@/lib/payments/payment-links-update-guard';
import { getFxService } from '@/lib/fx';
import { getFxSnapshotService } from '@/lib/fx/fx-snapshot-service';

export interface ConfirmPaymentParams {
  paymentLinkId: string;
  provider: 'stripe' | 'hedera' | 'wise';
  providerRef: string; // Stripe event_id, Hedera tx_id, or Wise transfer_id/event_id
  paymentIntentId?: string; // For Stripe
  checkoutSessionId?: string; // For Stripe
  transactionId?: string; // For Hedera or Wise transfer id
  amountReceived: number;
  currencyReceived: string;
  metadata?: Record<string, unknown>;
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

  // Normalize provider ref per rail
  const normalizedProviderRef =
    provider === 'hedera'
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
    const idempotencyCheck =
      provider === 'stripe'
        ? await checkStripeIdempotency(providerRef)
        : provider === 'wise'
          ? await checkWiseIdempotency(normalizedProviderRef)
          : await checkHederaIdempotency(normalizedProviderRef, providerRef);

    if (idempotencyCheck.exists) {
      log.info({
        correlationId,
        existingEventId: idempotencyCheck.eventId,
      }, 'Payment already processed (idempotent)');

      const earlyResult = {
        success: true,
        alreadyProcessed: true,
        paymentEventId: idempotencyCheck.eventId,
      };

      // Still try referral conversion in case it failed on first run
      if (idempotencyCheck.eventId) {
        try {
          await createReferralConversionFromPaymentConfirmed({
            paymentLinkId,
            paymentEventId: idempotencyCheck.eventId,
            grossAmount: amountReceived,
            currency: currencyReceived,
            provider: provider === 'hedera' ? 'hedera' : 'stripe',
            ...(provider === 'stripe' && { stripePaymentIntentId: paymentIntentId }),
            ...(provider === 'hedera' && { hederaTransactionId: normalizedProviderRef }),
          });
        } catch {
          // Ignore - already processed path
        }
      }

      return earlyResult;
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

      // 2. Update payment link to PAID (no paid_at - derived from payment_events)
      const updateData = { status: 'PAID' as const, updated_at: new Date() };
      assertPaymentLinksUpdateDataValid(updateData);
      await tx.payment_links.update({
        where: { id: paymentLinkId },
        data: updateData,
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

      if (provider === 'stripe') {
        paymentEventData.stripe_event_id = providerRef;
        paymentEventData.stripe_payment_intent_id = paymentIntentId;
      } else if (provider === 'hedera') {
        paymentEventData.hedera_transaction_id = normalizedProviderRef;
        paymentEventData.metadata = {
          ...paymentEventData.metadata,
          raw_transaction_id: providerRef,
          normalized_transaction_id: normalizedProviderRef,
        };
      } else if (provider === 'wise') {
        paymentEventData.wise_transfer_id = transactionId || normalizedProviderRef;
        paymentEventData.metadata = {
          ...paymentEventData.metadata,
          wise_event_id: providerRef,
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

      // 4. Create settlement FX snapshot (audit consistency), then post to ledger
      try {
        if (provider === 'stripe') {
          const invoiceCurrency = paymentLink.currency;
          const sameCurrency = currencyReceived.toUpperCase() === invoiceCurrency.toUpperCase();
          if (sameCurrency) {
            await getFxSnapshotService().createSettlementSnapshotInTx(tx, {
              payment_link_id: paymentLinkId,
              snapshot_type: 'SETTLEMENT',
              token_type: null,
              base_currency: invoiceCurrency,
              quote_currency: invoiceCurrency,
              rate: 1.0,
              provider: 'stripe',
              captured_at: new Date(),
            });
          } else {
            log.warn(
              { paymentLinkId, currencyReceived, invoiceCurrency, correlationId },
              'Stripe settlement: currency differs from invoice, skipping FX settlement snapshot'
            );
          }

          const { calculateStripeFee } = await import('@/lib/ledger/posting-rules/stripe');
          const amountInCents = Math.round(amountReceived * 100);
          const calculatedFee = calculateStripeFee(amountInCents, currencyReceived.toLowerCase());

          await postStripeSettlement({
            paymentLinkId,
            organizationId: paymentLink.organization_id,
            stripePaymentIntentId: paymentIntentId || providerRef,
            grossAmount: amountReceived.toString(),
            feeAmount: calculatedFee,
            currency: currencyReceived,
            correlationId,
          });
        } else if (provider === 'hedera' && tokenType) {
          const invoiceCurrency = paymentLink.currency;
          const fxService = getFxService();
          const exchangeRate = await fxService.getRate(tokenType, invoiceCurrency as 'USD' | 'AUD');
          await getFxSnapshotService().createSettlementSnapshotInTx(tx, {
            payment_link_id: paymentLinkId,
            snapshot_type: 'SETTLEMENT',
            token_type: tokenType,
            base_currency: tokenType,
            quote_currency: invoiceCurrency,
            rate: exchangeRate.rate,
            provider: exchangeRate.provider,
            captured_at: exchangeRate.timestamp,
          });

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
            idempotencyKey: correlationId,
          });
        } else if (provider === 'wise') {
          const invoiceCurrency = paymentLink.currency;
          const sameCurrency = currencyReceived.toUpperCase() === invoiceCurrency.toUpperCase();
          if (sameCurrency) {
            await getFxSnapshotService().createSettlementSnapshotInTx(tx, {
              payment_link_id: paymentLinkId,
              snapshot_type: 'SETTLEMENT',
              token_type: null,
              base_currency: invoiceCurrency,
              quote_currency: invoiceCurrency,
              rate: 1.0,
              provider: 'wise',
              captured_at: new Date(),
            });
          } else {
            log.warn(
              { paymentLinkId, currencyReceived, invoiceCurrency, correlationId },
              'Wise settlement: currency differs from invoice, skipping FX settlement snapshot'
            );
          }

          await postWiseSettlement({
            paymentLinkId,
            organizationId: paymentLink.organization_id,
            wiseTransferId: transactionId || normalizedProviderRef,
            grossAmount: amountReceived.toString(),
            currency: currencyReceived,
            correlationId,
          });
        }

        // Validate ledger balance
        await validatePostingBalance(paymentLinkId);

        log.info({
          correlationId,
          paymentLinkId,
        }, 'Ledger entries posted and validated');
      } catch (ledgerError: any) {
        log.error(
          {
            correlationId,
            organizationId: paymentLink.organization_id,
            paymentLinkId,
            error: ledgerError?.message,
          },
          'Ledger posting failed (will retry)'
        );

        // Create notification so user is aware
        try {
          await tx.notifications.create({
            data: {
              organization_id: paymentLink.organization_id,
              type: 'SYSTEM_ALERT',
              title: 'Ledger posting failed',
              message: `Ledger posting failed for payment link. Payment was confirmed but ledger entries could not be created. Correlation ID: ${correlationId}. Error: ${ledgerError?.message || 'Unknown'}. Ledger posting will be retried.`,
              data: {
                paymentLinkId,
                correlationId,
                error: ledgerError?.message,
              },
            },
          });
        } catch (notifErr: any) {
          log.warn(
            { correlationId, notifError: notifErr?.message },
            'Could not create ledger failure notification'
          );
        }
        // Do NOT throw - payment confirmed is source of truth; return 200
      }

      // 5. Queue Xero sync if enabled (idempotent upsert)
      if (config.features.xeroSync) {
        try {
          await tx.xero_syncs.upsert({
            where: {
              xero_syncs_payment_link_sync_type_unique: {
                payment_link_id: paymentLinkId,
                sync_type: 'INVOICE',
              },
            },
            update: {
              // If already exists, reset to PENDING for retry
              status: 'PENDING',
              request_payload: {
                paymentLinkId,
                organizationId: paymentLink.organization_id,
                correlationId,
                queuedBy: 'payment-confirmation',
                requeuedAt: new Date().toISOString(),
              },
              next_retry_at: new Date(),
              updated_at: new Date(),
            },
            create: {
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
          }, 'Xero sync queued (idempotent)');
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

    log.info(
      {
        correlationId,
        paymentEventId: result.paymentEventId,
        paymentLinkId,
      },
      'Payment confirmed (returning 200)'
    );

    // 6. Auto-create referral conversion (non-blocking; must not fail payment)
    if (result.success && result.paymentEventId) {
      try {
        const refResult = await createReferralConversionFromPaymentConfirmed({
          paymentLinkId,
          paymentEventId: result.paymentEventId,
          grossAmount: amountReceived,
          currency: currencyReceived,
          provider: provider === 'hedera' ? 'hedera' : provider === 'wise' ? 'wise' : 'stripe',
          ...(provider === 'stripe' && { stripePaymentIntentId: paymentIntentId }),
          ...(provider === 'hedera' && { hederaTransactionId: normalizedProviderRef }),
          ...(provider === 'wise' && { wiseTransferId: transactionId || normalizedProviderRef }),
        });
        if (refResult.created) {
          log.info(
            {
              correlationId,
              paymentEventId: result.paymentEventId,
              paymentLinkId,
              conversionId: refResult.conversionId,
              providerRef: provider === 'stripe' ? paymentIntentId : normalizedProviderRef,
            },
            '[REFERRAL_AUTO_CONVERSION] conversion created'
          );
        } else if (refResult.skipped) {
          log.info(
            {
              correlationId,
              paymentEventId: result.paymentEventId,
              paymentLinkId,
              reason: refResult.reason,
            },
            '[REFERRAL_AUTO_CONVERSION] skipped (idempotent)'
          );
        }
      } catch (refErr: any) {
        log.warn(
          { correlationId, paymentEventId: result.paymentEventId, paymentLinkId, err: refErr?.message },
          '[REFERRAL_AUTO_CONVERSION] failed (non-blocking)'
        );
      }
    }

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
 */
async function checkHederaIdempotency(normalizedTxId: string, rawTxId?: string) {
  const existing = await prisma.payment_events.findFirst({
    where: {
      OR: [
        { hedera_transaction_id: normalizedTxId },
        ...(rawTxId && rawTxId !== normalizedTxId
          ? [{ hedera_transaction_id: rawTxId }]
          : []),
      ],
    },
  });
  return { exists: !!existing, eventId: existing?.id };
}

/**
 * Check if Wise payment already processed (by transfer id or event id in providerRef)
 */
async function checkWiseIdempotency(transferIdOrEventId: string) {
  const existing = await prisma.payment_events.findFirst({
    where: {
      OR: [
        { wise_transfer_id: transferIdOrEventId },
        { correlation_id: transferIdOrEventId },
      ],
    },
  });
  return { exists: !!existing, eventId: existing?.id };
}

