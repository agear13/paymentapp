/**
 * Reconciliation rail adapter contract.
 *
 * Provider-specific logic normalizes events into CommercialPaymentEvent.
 * The reconciliation engine operates only on normalized events.
 */

import type { CommercialPaymentEvent } from '@/lib/commercial-reconciliation/types';
import type { PaymentRailId } from '@/lib/payments/payment-rail-registry';

/** Raw payment event shape from Provvypay persistence — adapter input. */
export type RawPaymentEventInput = {
  id: string;
  payment_link_id: string;
  event_type: string;
  payment_method?: string | null;
  amount_received?: unknown;
  currency_received?: string | null;
  stripe_payment_intent_id?: string | null;
  hedera_transaction_id?: string | null;
  wise_transfer_id?: string | null;
  source_reference?: string | null;
  correlation_id?: string | null;
  received_at?: Date | string | null;
  created_at: Date | string;
  metadata?: unknown;
  pilot_deal_id?: string | null;
};

export type NormalizePaymentEventContext = {
  paymentLinkId: string;
  organizationId: string;
  agreementId?: string | null;
  invoiceAmount?: number;
};

export interface ReconciliationRailAdapter {
  readonly railId: PaymentRailId;
  /** Whether this adapter handles the raw payment method / event. */
  supports(raw: RawPaymentEventInput): boolean;
  /** Normalize provider-specific event into CommercialPaymentEvent. */
  normalize(
    raw: RawPaymentEventInput,
    context: NormalizePaymentEventContext
  ): CommercialPaymentEvent | null;
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toIsoDate(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString();
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function providerReference(raw: RawPaymentEventInput): string | null {
  return (
    raw.stripe_payment_intent_id ??
    raw.hedera_transaction_id ??
    raw.wise_transfer_id ??
    raw.source_reference ??
    raw.correlation_id ??
    null
  );
}

function baseNormalize(
  raw: RawPaymentEventInput,
  context: NormalizePaymentEventContext,
  railId: PaymentRailId
): CommercialPaymentEvent | null {
  if (raw.event_type !== 'PAYMENT_CONFIRMED') return null;

  const amount = toNumber(raw.amount_received);
  if (amount <= 0) return null;

  return {
    id: raw.id,
    paymentLinkId: context.paymentLinkId,
    paymentEventId: raw.id,
    amount,
    currency: (raw.currency_received ?? 'AUD').toUpperCase(),
    receivedAt: toIsoDate(raw.received_at ?? raw.created_at),
    paymentRail: railId,
    providerReference: providerReference(raw),
    agreementId: context.agreementId ?? raw.pilot_deal_id ?? null,
    organizationId: context.organizationId,
    metadata:
      raw.metadata && typeof raw.metadata === 'object'
        ? (raw.metadata as Record<string, unknown>)
        : null,
  };
}

export const StripeReconciliationAdapter: ReconciliationRailAdapter = {
  railId: 'stripe',
  supports(raw) {
    if (raw.payment_method && raw.payment_method !== 'STRIPE') return false;
    return raw.payment_method === 'STRIPE' || Boolean(raw.stripe_payment_intent_id);
  },
  normalize(raw, context) {
    return baseNormalize(raw, context, 'stripe');
  },
};

export const WiseReconciliationAdapter: ReconciliationRailAdapter = {
  railId: 'wise',
  supports(raw) {
    if (raw.payment_method && raw.payment_method !== 'WISE') return false;
    return raw.payment_method === 'WISE' || Boolean(raw.wise_transfer_id);
  },
  normalize(raw, context) {
    return baseNormalize(raw, context, 'wise');
  },
};

export const ManualBankReconciliationAdapter: ReconciliationRailAdapter = {
  railId: 'manual_bank',
  supports(raw) {
    return raw.payment_method === 'MANUAL_BANK' || raw.payment_method === 'MANUAL';
  },
  normalize(raw, context) {
    return baseNormalize(raw, context, 'manual_bank');
  },
};

export const CryptoReconciliationAdapter: ReconciliationRailAdapter = {
  railId: 'crypto',
  supports(raw) {
    const method = raw.payment_method;
    return (
      method === 'CRYPTO' ||
      method === 'HEDERA' ||
      method === 'EVM_WALLET' ||
      Boolean(raw.hedera_transaction_id)
    );
  },
  normalize(raw, context) {
    const method = raw.payment_method;
    let railId: PaymentRailId = 'crypto';
    if (method === 'HEDERA') railId = 'hedera';
    if (method === 'EVM_WALLET') railId = 'evm_wallet';
    return baseNormalize(raw, context, railId);
  },
};

export const RECONCILIATION_RAIL_ADAPTERS: readonly ReconciliationRailAdapter[] = [
  StripeReconciliationAdapter,
  WiseReconciliationAdapter,
  ManualBankReconciliationAdapter,
  CryptoReconciliationAdapter,
] as const;

/** Normalize raw payment events using the appropriate rail adapter. */
export function normalizeCommercialPaymentEvents(
  rawEvents: RawPaymentEventInput[],
  context: NormalizePaymentEventContext
): CommercialPaymentEvent[] {
  const results: CommercialPaymentEvent[] = [];

  for (const raw of rawEvents) {
    const adapter =
      RECONCILIATION_RAIL_ADAPTERS.find((a) => a.supports(raw)) ??
      CryptoReconciliationAdapter;
    const normalized = adapter.normalize(raw, context);
    if (normalized) {
      results.push(normalized);
    }
  }

  return results;
}

/** Resolve adapter for a payment rail id (for extension / testing). */
export function getReconciliationAdapter(
  railId: PaymentRailId
): ReconciliationRailAdapter | undefined {
  return RECONCILIATION_RAIL_ADAPTERS.find((a) => a.railId === railId);
}
