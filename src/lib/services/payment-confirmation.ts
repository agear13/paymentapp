/**
 * Unified Payment Confirmation Service
 * Handles payment confirmation pipeline for both Stripe and Hedera
 * Ensures idempotency and atomicity
 */

import {
  PaymentEventRecordStatus,
  PaymentEventSourceType,
  type PaymentLinkStatus,
  type PaymentMethod,
} from '@prisma/client';
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
import { applyRevenueShareSplits } from '@/lib/referrals/commission-posting';
import { resolveReferralCommissionMetadata } from '@/lib/referrals/commission-metadata.server';
import { reconcileCommissionArtifactsForPaymentEvent } from '@/lib/referrals/commission-reconcile.server';
import { assertPaymentLinksUpdateDataValid } from '@/lib/payments/payment-links-update-guard';
import { getFxService } from '@/lib/fx';
import { getFxSnapshotService } from '@/lib/fx/fx-snapshot-service';
import {
  transitionPaymentLinkState,
  InvalidPaymentLinkTransitionError,
  isValidTransition,
} from '@/lib/payments/state-machine';
import { validateLedgerInvariant } from '@/lib/ledger/invariant-checker';
import { orchestrateFundingAfterInvoiceSettlement } from '@/lib/operations/funding/bridge-invoice-settlement.server';
import { commissionPropagationTrace } from '@/lib/referrals/commission-propagation-trace';

export interface ConfirmPaymentParams {
  paymentLinkId: string;
  provider: 'stripe' | 'hedera' | 'wise' | 'manual';
  /** Stripe event_id, Hedera tx_id, or Wise transfer_id/event_id */
  providerRef: string;
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
 * Payment link statuses from which confirmPayment may transition to PAID and create settlement artifacts.
 * OPEN: automated rails + R1 operator manual settlement.
 * PAID_UNVERIFIED / REQUIRES_REVIEW: R3 assisted bank/crypto review approval.
 * If link is already PAID without PAYMENT_CONFIRMED, settlement artifacts are backfilled (no transition).
 */
export const CONFIRM_PAYMENT_SETTLEMENT_ENTRY_STATUSES: readonly PaymentLinkStatus[] = [
  'OPEN',
  'PAID_UNVERIFIED',
  'REQUIRES_REVIEW',
] as const;

async function runCommissionReconcileAfterSettlement(params: {
  paymentEventId: string;
  paymentLinkId: string;
  grossAmount: number;
  currency: string;
  correlationId: string;
  orchestrateFunding: boolean;
}): Promise<void> {
  try {
    await reconcileCommissionArtifactsForPaymentEvent(params.paymentEventId, {
      grossAmount: params.grossAmount,
      currency: params.currency,
      correlationId: params.correlationId,
      orchestrateFunding: params.orchestrateFunding,
    });
  } catch (reconcileErr: unknown) {
    log.error(
      'Commission artifact reconcile failed (non-blocking)',
      reconcileErr instanceof Error ? reconcileErr : undefined,
      {
        correlationId: params.correlationId,
        paymentLinkId: params.paymentLinkId,
        paymentEventId: params.paymentEventId,
        error: reconcileErr instanceof Error ? reconcileErr.message : String(reconcileErr),
      }
    );
  }
}

function referralProviderForConfirmPayment(
  provider: ConfirmPaymentParams['provider']
): 'stripe' | 'hedera' | 'wise' | 'manual' {
  if (provider === 'hedera') return 'hedera';
  if (provider === 'wise') return 'wise';
  if (provider === 'manual') return 'manual';
  return 'stripe';
}

/** Maps confirmPayment provider (+ metadata rail) to a valid PaymentMethod on payment_events. */
export function resolvePaymentMethodForEvent(
  provider: ConfirmPaymentParams['provider'],
  metadata?: Record<string, unknown>
): PaymentMethod | null {
  if (provider === 'manual') {
    const rail = metadata?.rail;
    if (rail === 'MANUAL_BANK' || rail === 'CRYPTO') return rail;
    return 'MANUAL';
  }
  return provider.toUpperCase() as PaymentMethod;
}

/**
 * Canonical settlement orchestrator.
 *
 * Architectural guardrails:
 * - `PAYMENT_CONFIRMED` is the settlement truth record.
 * - Settlement must converge through `confirmPayment()` (webhook, reconciliation, manual recoveries).
 * - State transition + payment event + ledger posting + downstream sync enqueue remain transaction-coupled.
 * - Replays must safely no-op and never duplicate ledger/Xero side effects.
 */
export async function confirmPayment(
  params: ConfirmPaymentParams
): Promise<ConfirmPaymentResult> {
  const startedAt = Date.now();
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
  const correlationId =
    params.correlationId ||
    generateCorrelationId(
      provider as Parameters<typeof generateCorrelationId>[0],
      normalizedProviderRef
    );

  log.info('Starting payment confirmation', {
    correlationId,
    paymentLinkId,
    provider,
    providerRef,
    normalizedProviderRef: provider === 'hedera' ? normalizedProviderRef : undefined,
    amountReceived,
    currencyReceived,
  });

  try {
    const idempotencyCheck =
      provider === 'stripe'
        ? await checkStripeIdempotency(providerRef)
        : provider === 'wise'
          ? await checkWiseIdempotency(normalizedProviderRef)
          : provider === 'manual'
            ? await checkManualIdempotency(normalizedProviderRef, paymentLinkId)
            : await checkHederaIdempotency(normalizedProviderRef, providerRef);

    if (idempotencyCheck.exists) {
      log.info('Payment already processed (idempotent)', {
        correlationId,
        existingEventId: idempotencyCheck.eventId,
      });

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
            provider: referralProviderForConfirmPayment(provider),
            ...(provider === 'stripe' && { stripePaymentIntentId: paymentIntentId }),
            ...(provider === 'hedera' && { hederaTransactionId: normalizedProviderRef }),
            ...(provider === 'wise' && { wiseTransferId: transactionId || normalizedProviderRef }),
          });
        } catch {
          // Ignore - already processed path
        }

        await runCommissionReconcileAfterSettlement({
          paymentEventId: idempotencyCheck.eventId,
          paymentLinkId,
          grossAmount: amountReceived,
          currency: currencyReceived,
          correlationId,
          orchestrateFunding: true,
        });
      }

      return earlyResult;
    }

    // Execute confirmation pipeline in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get and validate payment link with fresh state
      const paymentLink = await tx.payment_links.findUnique({
        where: { id: paymentLinkId },
      });

      if (!paymentLink) {
        throw new Error(`Payment link ${paymentLinkId} not found`);
      }

      // PRIMARY idempotency guard: PAYMENT_CONFIRMED exists for this link.
      const existingConfirmed = await tx.payment_events.findFirst({
        where: {
          payment_link_id: paymentLinkId,
          event_type: 'PAYMENT_CONFIRMED',
        },
        select: { id: true },
      });

      if (existingConfirmed) {
        log.info('Idempotent skip: PAYMENT_CONFIRMED already exists for paymentLinkId', {
          correlationId,
          paymentLinkId,
          existingPaymentEventId: existingConfirmed.id,
        });

        await getFxSnapshotService().ensureSettlementFxSnapshot(tx, {
          id: paymentLinkId,
          currency: paymentLink.invoice_currency ?? paymentLink.currency,
          invoice_currency: paymentLink.invoice_currency ?? paymentLink.currency,
        });

        return {
          success: true,
          alreadyProcessed: true,
          paymentEventId: existingConfirmed.id,
        };
      }

      // Transition to PAID when not already paid (OPEN, PAID_UNVERIFIED, REQUIRES_REVIEW per state machine).
      // If already PAID without PAYMENT_CONFIRMED (legacy review path), backfill settlement only.
      if (paymentLink.status === 'PAID') {
        log.info('confirmPayment: link already PAID, backfilling settlement artifacts', {
          correlationId,
          paymentLinkId,
          provider,
        });
      } else {
        if (!isValidTransition(paymentLink.status, 'PAID')) {
          throw new InvalidPaymentLinkTransitionError(
            paymentLinkId,
            paymentLink.status,
            'PAID',
            `confirmPayment:${provider}`
          );
        }
        if (
          !CONFIRM_PAYMENT_SETTLEMENT_ENTRY_STATUSES.includes(
            paymentLink.status as PaymentLinkStatus
          )
        ) {
          throw new InvalidPaymentLinkTransitionError(
            paymentLinkId,
            paymentLink.status,
            'PAID',
            `confirmPayment:${provider}`
          );
        }
        try {
          await transitionPaymentLinkState({
            tx,
            paymentLinkId,
            targetState: 'PAID',
            source: `confirmPayment:${provider}`,
            reason: 'settlement_confirmed',
            metadata: {
              providerRef: normalizedProviderRef,
              priorStatus: paymentLink.status,
            },
          });
        } catch (err) {
          if (err instanceof InvalidPaymentLinkTransitionError) {
            log.error(
              'Invalid payment link state transition during settlement',
              err,
              {
                correlationId,
                paymentLinkId,
                provider,
                currentStatus: paymentLink.status,
                targetStatus: 'PAID',
              }
            );
          }
          throw err;
        }
      }

      // 2. Create payment event with idempotency fields
      const sourceType: PaymentEventSourceType =
        provider === 'stripe'
          ? PaymentEventSourceType.STRIPE
          : provider === 'hedera'
            ? PaymentEventSourceType.CRYPTO
            : provider === 'manual'
              ? PaymentEventSourceType.MANUAL
              : PaymentEventSourceType.WISE;

      const paymentEventData: any = {
        payment_link_id: paymentLinkId,
        organization_id: paymentLink.organization_id,
        event_type: 'PAYMENT_CONFIRMED',
        payment_method: resolvePaymentMethodForEvent(provider, metadata),
        source_type: sourceType,
        source_reference: normalizedProviderRef,
        gross_amount: amountReceived,
        net_amount: null,
        amount_received: amountReceived,
        currency_received: currencyReceived,
        received_at: new Date(),
        record_status: PaymentEventRecordStatus.RECORDED,
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

      const pilotDealIdFromMeta =
        typeof metadata?.pilot_deal_id === 'string'
          ? String(metadata.pilot_deal_id).trim()
          : undefined;
      if (pilotDealIdFromMeta) {
        const pilotDeal = await tx.deal_network_pilot_deals.findUnique({
          where: { id: pilotDealIdFromMeta },
          select: { id: true },
        });
        if (pilotDeal?.id) {
          paymentEventData.pilot_deal_id = pilotDeal.id;
        } else {
          log.warn('Ignoring metadata pilot_deal_id (no matching deal_network_pilot_deals row)', {
            correlationId,
            pilotDealIdFromMeta,
          });
        }
      }

      const linkPilotDealId =
        typeof (paymentLink as { pilot_deal_id?: string | null }).pilot_deal_id === 'string'
          ? String((paymentLink as { pilot_deal_id?: string | null }).pilot_deal_id).trim()
          : '';
      if (!paymentEventData.pilot_deal_id && linkPilotDealId) {
        paymentEventData.pilot_deal_id = linkPilotDealId;
      }

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
      } else if (provider === 'manual') {
        paymentEventData.metadata = {
          ...paymentEventData.metadata,
          manual_settlement: true,
          operator_settlement: true,
        };
      }

      const paymentEvent = await tx.payment_events.create({
        data: paymentEventData,
      });

      log.info('Payment event created', {
        correlationId,
        paymentEventId: paymentEvent.id,
        paymentLinkId,
      });

      // 4. Post to ledger — all three rails are fully atomic.
      // Any error inside a settlement function propagates here, aborts
      // prisma.$transaction, and rolls back payment_link + payment_event +
      // every ledger write together. The caller receives a non-2xx response;
      // the provider (Stripe webhook, Hedera poller, Wise webhook) retries.

      await getFxSnapshotService().ensureSettlementFxSnapshot(tx, {
        id: paymentLinkId,
        currency: paymentLink.invoice_currency ?? paymentLink.currency,
        invoice_currency: paymentLink.invoice_currency ?? paymentLink.currency,
      });

      if (provider === 'stripe') {
        // Atomic: any error here rolls back the enclosing prisma.$transaction.
        const { calculateStripeFee } = await import('@/lib/ledger/posting-rules/stripe');
        const amountInCents = Math.round(amountReceived * 100);
        const calculatedFee = calculateStripeFee(amountInCents, currencyReceived.toLowerCase());

        await postStripeSettlement(
          {
            paymentLinkId,
            organizationId: paymentLink.organization_id,
            stripePaymentIntentId: paymentIntentId || providerRef,
            grossAmount: amountReceived.toString(),
            feeAmount: String(calculatedFee),
            currency: currencyReceived,
            correlationId,
          },
          tx, // ledger writes share the enclosing transaction
        );

        log.info('Stripe ledger entries posted (atomic)', { correlationId, paymentLinkId });
      } else if (provider === 'hedera') {
        // Atomic: any error rolls back the enclosing prisma.$transaction.
        if (!tokenType) {
          throw new Error('tokenType is required for Hedera payments');
        }

        const invoiceCurrency = paymentLink.invoice_currency ?? paymentLink.currency;
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
        const rate = fxRate ?? exchangeRate.rate;

        await postHederaSettlement(
          {
            paymentLinkId,
            organizationId: paymentLink.organization_id,
            tokenType,
            cryptoAmount: String(amountReceived),
            invoiceAmount: paymentLink.amount.toString(),
            invoiceCurrency: paymentLink.invoice_currency ?? paymentLink.currency,
            fxRate: rate,
            transactionId: transactionId || providerRef,
            correlationId,
            idempotencyKey: correlationId,
          },
          tx,
        );

        log.info('Hedera ledger entries posted (atomic)', { correlationId, paymentLinkId });
      } else if (provider === 'wise') {
        // Atomic: any error rolls back the enclosing prisma.$transaction.
        await postWiseSettlement(
          {
            paymentLinkId,
            organizationId: paymentLink.organization_id,
            wiseTransferId: transactionId || normalizedProviderRef,
            grossAmount: amountReceived.toString(),
            currency: currencyReceived,
            correlationId,
          },
          tx,
        );

        log.info('Wise ledger entries posted (atomic)', { correlationId, paymentLinkId });
      } else if (provider === 'manual') {
        // Reuse Wise clearing posting rule (DR 1055 / CR 1200) — no fee; operator off-rail settlement.
        await postWiseSettlement(
          {
            paymentLinkId,
            organizationId: paymentLink.organization_id,
            wiseTransferId: `manual-${normalizedProviderRef}`,
            grossAmount: amountReceived.toString(),
            currency: currencyReceived,
            correlationId,
          },
          tx,
        );

        log.info('Manual operator settlement ledger posted (atomic, via Wise clearing)', {
          correlationId,
          paymentLinkId,
          providerRef: normalizedProviderRef,
        });
      }

      // 5. Queue Xero sync if enabled (idempotent upsert)
      if (config.features.xeroSync) {
        try {
          await tx.xero_syncs.upsert({
            where: {
              xero_syncs_payment_link_sync_type_unique: {
                payment_link_id: paymentLinkId,
                sync_type: 'PAYMENT',
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
              sync_type: 'PAYMENT',
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

          log.info('Xero sync queued (idempotent)', {
            correlationId,
            paymentLinkId,
          });
        } catch (xeroError: unknown) {
          // Don't fail payment if Xero sync fails
          log.error(
            'Xero sync queue failed (non-blocking)',
            xeroError instanceof Error ? xeroError : undefined,
            {
              correlationId,
              error: xeroError instanceof Error ? xeroError.message : String(xeroError),
            }
          );
        }
      }

      return {
        success: true,
        paymentEventId: paymentEvent.id,
        alreadyProcessed: false,
      };
    });

    log.info('Payment confirmed (returning 200)', {
      correlationId,
      paymentEventId: result.paymentEventId,
      paymentLinkId,
      settlementDurationMs: Date.now() - startedAt,
      replayNoop: result.alreadyProcessed === true,
    });

    if (result.success && result.paymentEventId && result.alreadyProcessed === false) {
      commissionPropagationTrace('payment_confirmed_committed', {
        correlationId,
        paymentEventId: result.paymentEventId,
        paymentLinkId,
        provider,
      });
    }

    // Validate cumulative ledger balance against committed data.
    // This runs after the transaction commits so the global prisma client
    // can see the new entries. A failure here is a monitoring signal — the
    // payment is already confirmed and cannot be rolled back, so we log and
    // alert rather than throw. The per-batch validateBalance inside
    // LedgerEntryService is the primary correctness gate.
    if (!result.alreadyProcessed) {
      try {
        await validatePostingBalance(paymentLinkId);
        const invariantRows = await validateLedgerInvariant(paymentLinkId);
        for (const invariant of invariantRows) {
          if (!invariant.balanced) {
            log.error('Settlement committed with ledger invariant violation', undefined, {
              correlationId,
              paymentLinkId,
              currency: invariant.currency,
              debitTotal: invariant.debitTotal,
              creditTotal: invariant.creditTotal,
              difference: invariant.difference,
            });
          }
        }
      } catch (balanceError: unknown) {
        log.error(
          'Post-commit balance validation failed — ledger may be unbalanced, manual reconciliation required',
          balanceError instanceof Error ? balanceError : undefined,
          { correlationId, paymentLinkId, error: balanceError instanceof Error ? balanceError.message : String(balanceError) },
        );
      }
    }

    // 6. Auto-create referral conversion (non-blocking; must not fail payment)
    if (result.success && result.paymentEventId) {
      try {
        const refResult = await createReferralConversionFromPaymentConfirmed({
          paymentLinkId,
          paymentEventId: result.paymentEventId,
          grossAmount: amountReceived,
          currency: currencyReceived,
          provider: referralProviderForConfirmPayment(provider),
          ...(provider === 'stripe' && { stripePaymentIntentId: paymentIntentId }),
          ...(provider === 'hedera' && { hederaTransactionId: normalizedProviderRef }),
          ...(provider === 'wise' && { wiseTransferId: transactionId || normalizedProviderRef }),
        });
        if (refResult.created) {
          log.info('[REFERRAL_AUTO_CONVERSION] conversion created', {
            correlationId,
            paymentEventId: result.paymentEventId,
            paymentLinkId,
            conversionId: refResult.conversionId,
            providerRef: provider === 'stripe' ? paymentIntentId : normalizedProviderRef,
          });
        } else if (refResult.skipped) {
          log.info('[REFERRAL_AUTO_CONVERSION] skipped (idempotent)', {
            correlationId,
            paymentEventId: result.paymentEventId,
            paymentLinkId,
            reason: refResult.reason,
          });
        }
      } catch (refErr: any) {
        log.warn('[REFERRAL_AUTO_CONVERSION] failed (non-blocking)', {
          correlationId,
          paymentEventId: result.paymentEventId,
          paymentLinkId,
          err: refErr instanceof Error ? refErr.message : String(refErr),
        });
      }
    }

    // Revenue share (commission) — only when this invocation created a new PAYMENT_CONFIRMED row.
    // Idempotent webhook retries set alreadyProcessed: true; do not re-run (avoids redundant work; commission is idempotent anyway).
    if (result.success && result.paymentEventId && result.alreadyProcessed === false) {
      try {
        const [pe, link] = await Promise.all([
          prisma.payment_events.findUnique({
            where: { id: result.paymentEventId },
            select: { metadata: true },
          }),
          prisma.payment_links.findUnique({
            where: { id: paymentLinkId },
            select: {
              organization_id: true,
              referral_link_id: true,
              commission_attribution_snapshot: true,
            },
          }),
        ]);
        if (link?.organization_id) {
          const paymentLinkReferralLinkId =
            typeof link.referral_link_id === 'string' ? link.referral_link_id : null;
          const referralMetadata = await resolveReferralCommissionMetadata({
            paymentEventMetadata: pe?.metadata ?? null,
            paymentLinkReferralLinkId,
            paymentLinkCommissionSnapshot: link.commission_attribution_snapshot ?? null,
          });
          commissionPropagationTrace('commission_metadata_resolved', {
            correlationId,
            paymentEventId: result.paymentEventId,
            paymentLinkId,
            referralLinkId: paymentLinkReferralLinkId,
            hasReferralMetadata: Boolean(referralMetadata?.referral_link_id),
          });
          commissionPropagationTrace('commission_apply_enter', {
            correlationId,
            paymentEventId: result.paymentEventId,
            paymentLinkId,
          });
          await applyRevenueShareSplits({
            stripeEventId: result.paymentEventId,
            commissionSourceId: result.paymentEventId,
            referralMetadata,
            paymentLinkId,
            organizationId: link.organization_id,
            grossAmount: amountReceived,
            currency: currencyReceived,
            correlationId,
          });
        }
      } catch (commissionErr: unknown) {
        log.error(
          'Revenue share failed (non-blocking)',
          commissionErr instanceof Error ? commissionErr : undefined,
          {
            correlationId,
            paymentLinkId,
            paymentEventId: result.paymentEventId,
            error: commissionErr instanceof Error ? commissionErr.message : String(commissionErr),
          }
        );
      }
    } else if (result.success && result.paymentEventId && result.alreadyProcessed === true) {
      commissionPropagationTrace('commission_block_skipped_idempotent', {
        correlationId,
        paymentEventId: result.paymentEventId,
        paymentLinkId,
      });
      await runCommissionReconcileAfterSettlement({
        paymentEventId: result.paymentEventId,
        paymentLinkId,
        grossAmount: amountReceived,
        currency: currencyReceived,
        correlationId,
        orchestrateFunding: true,
      });
    }

    if (result.success && result.paymentEventId && result.alreadyProcessed === false) {
      try {
        await orchestrateFundingAfterInvoiceSettlement(result.paymentEventId);
      } catch (orchErr: unknown) {
        log.warn('Operational funding orchestration failed (non-blocking)', {
          correlationId,
          paymentEventId: result.paymentEventId,
          error: orchErr instanceof Error ? orchErr.message : String(orchErr),
        });
      }
    }

    return result;
  } catch (error: any) {
    log.error(
      'Payment confirmation failed',
      error instanceof Error ? error : undefined,
      {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        settlementDurationMs: Date.now() - startedAt,
      }
    );

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

/**
 * Operator manual settlement — one PAYMENT_CONFIRMED per link (source_reference stable per link).
 */
async function checkManualIdempotency(sourceReference: string, paymentLinkId: string) {
  const onLink = await prisma.payment_events.findFirst({
    where: {
      payment_link_id: paymentLinkId,
      event_type: 'PAYMENT_CONFIRMED',
    },
    select: { id: true },
  });
  if (onLink) {
    return { exists: true, eventId: onLink.id };
  }

  const byRef = await prisma.payment_events.findFirst({
    where: {
      source_reference: sourceReference,
      event_type: 'PAYMENT_CONFIRMED',
    },
    select: { id: true },
  });
  return { exists: !!byRef, eventId: byRef?.id };
}

