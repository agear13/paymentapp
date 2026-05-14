/**
 * Unified Payment Confirmation Service
 * Handles payment confirmation pipeline for both Stripe and Hedera
 * Ensures idempotency and atomicity
 */

import {
  PaymentEventRecordStatus,
  PaymentEventSourceType,
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
import type Stripe from 'stripe';
import {
  applyRevenueShareSplits,
  coerceJsonToCommissionMetadata,
  parseReferralSplitsFromMetadata,
} from '@/lib/referrals/commission-posting';
import { isCompleteCommissionAttributionMetadata } from '@/lib/referrals/commission-attribution-snapshot';
import { assertPaymentLinksUpdateDataValid } from '@/lib/payments/payment-links-update-guard';
import { getFxService } from '@/lib/fx';
import { getFxSnapshotService } from '@/lib/fx/fx-snapshot-service';
import {
  transitionPaymentLinkState,
  InvalidPaymentLinkTransitionError,
} from '@/lib/payments/state-machine';
import { validateLedgerInvariant } from '@/lib/ledger/invariant-checker';

export interface ConfirmPaymentParams {
  paymentLinkId: string;
  provider: 'stripe' | 'hedera' | 'wise';
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

function setCommissionMetaIfEmpty(
  out: Record<string, string>,
  key: string,
  value: string | null | undefined
) {
  const cur = out[key];
  if (cur != null && String(cur).trim() !== '') return;
  if (value == null || String(value).trim() === '') return;
  out[key] = String(value);
}

/**
 * Merge payment event metadata with immutable `payment_links.commission_attribution_snapshot`,
 * then load splits/rules from DB only if commission parsers still lack a full shape.
 * Invoice snapshot wins over sparse event metadata for commission keys when complete.
 */
async function resolveReferralCommissionMetadata(params: {
  paymentEventMetadata: unknown;
  paymentLinkReferralLinkId: string | null;
  paymentLinkCommissionSnapshot: unknown;
}): Promise<Stripe.Metadata | undefined> {
  const base = coerceJsonToCommissionMetadata(params.paymentEventMetadata);
  const snapMd = coerceJsonToCommissionMetadata(params.paymentLinkCommissionSnapshot);

  let out: Record<string, string> = { ...(base ?? {}) };
  if (snapMd && isCompleteCommissionAttributionMetadata(snapMd)) {
    out = {
      ...out,
      ...Object.fromEntries(
        Object.entries(snapMd).filter(([, v]) => v != null && String(v).trim() !== '')
      ),
    };
  }

  const fromEvent = String(out.referral_link_id ?? '').trim();
  if (!fromEvent && params.paymentLinkReferralLinkId) {
    out.referral_link_id = params.paymentLinkReferralLinkId;
  }

  const rid = String(out.referral_link_id ?? '').trim();
  if (!rid) {
    return Object.keys(out).length > 0 ? (out as Stripe.Metadata) : undefined;
  }

  let md = out as Stripe.Metadata;
  if (isCompleteCommissionAttributionMetadata(md)) {
    return md;
  }

  const refLink = await prisma.referral_links.findUnique({
    where: { id: rid },
    include: {
      referral_link_splits: { orderBy: { sort_order: 'asc' } },
      referral_rules: { orderBy: { created_at: 'desc' }, take: 1 },
    },
  });
  if (!refLink) {
    return Object.keys(out).length > 0 ? (out as Stripe.Metadata) : undefined;
  }

  setCommissionMetaIfEmpty(out, 'referral_code', refLink.code);

  const splits = refLink.referral_link_splits;
  const rule = refLink.referral_rules[0];
  if (splits.length > 0) {
    if (!parseReferralSplitsFromMetadata(out as Stripe.Metadata)) {
      out.referral_splits = JSON.stringify(
        splits.map((s) => ({
          split_id: s.id,
          label: s.label,
          percentage: Number(s.percentage),
          beneficiary_id: s.beneficiary_id ?? null,
          sort_order: s.sort_order,
        }))
      );
    }
    // Matches referral-checkout: multi-split commissions use GROSS basis.
    setCommissionMetaIfEmpty(out, 'commission_basis', 'GROSS');
  } else if (rule) {
    setCommissionMetaIfEmpty(out, 'consultant_id', rule.consultant_id ?? '');
    setCommissionMetaIfEmpty(out, 'bd_partner_id', rule.bd_partner_id ?? '');
    setCommissionMetaIfEmpty(out, 'consultant_pct', rule.consultant_pct.toString());
    setCommissionMetaIfEmpty(out, 'bd_partner_pct', rule.bd_partner_pct.toString());
    setCommissionMetaIfEmpty(out, 'commission_basis', rule.basis);
  }

  md = out as Stripe.Metadata;
  return Object.keys(out).length > 0 ? md : undefined;
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
            provider:
              provider === 'hedera'
                ? 'hedera'
                : provider === 'wise'
                  ? 'wise'
                  : 'stripe',
            ...(provider === 'stripe' && { stripePaymentIntentId: paymentIntentId }),
            ...(provider === 'hedera' && { hederaTransactionId: normalizedProviderRef }),
            ...(provider === 'wise' && { wiseTransferId: transactionId || normalizedProviderRef }),
          });
        } catch {
          // Ignore - already processed path
        }
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

      // Secondary guard: link already marked as PAID without a confirmed row (defensive).
      if (paymentLink.status === 'PAID') {
        log.warn('Payment link already paid but no PAYMENT_CONFIRMED found (defensive skip)', {
          correlationId,
          paymentLinkId,
          status: paymentLink.status,
        });
        await getFxSnapshotService().ensureSettlementFxSnapshot(tx, {
          id: paymentLinkId,
          currency: paymentLink.invoice_currency ?? paymentLink.currency,
          invoice_currency: paymentLink.invoice_currency ?? paymentLink.currency,
        });
        return {
          success: true,
          alreadyProcessed: true,
          paymentEventId: undefined,
        };
      }

      // Enforce valid OPEN -> PAID transition via core state machine.
      try {
        await transitionPaymentLinkState({
          tx,
          paymentLinkId,
          targetState: 'PAID',
          source: `confirmPayment:${provider}`,
          reason: 'settlement_confirmed',
          metadata: {
            providerRef: normalizedProviderRef,
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

      // 2. Create payment event with idempotency fields
      const sourceType: PaymentEventSourceType =
        provider === 'stripe'
          ? PaymentEventSourceType.STRIPE
          : provider === 'hedera'
            ? PaymentEventSourceType.CRYPTO
            : PaymentEventSourceType.WISE;

      const paymentEventData: any = {
        payment_link_id: paymentLinkId,
        organization_id: paymentLink.organization_id,
        event_type: 'PAYMENT_CONFIRMED',
        payment_method: provider.toUpperCase(),
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
          provider:
            provider === 'hedera'
              ? 'hedera'
              : provider === 'wise'
                ? 'wise'
                : 'stripe',
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

