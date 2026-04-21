/**
 * Shared helpers for deciding whether a payment_events row indicates real
 * settlement / rails activity (vs. status-only audit rows).
 * Used by manual reopen guards and delete safety checks.
 */

export type PaymentEventEvidenceFields = {
  event_type: string;
  amount_received: unknown;
  stripe_payment_intent_id?: string | null;
  hedera_transaction_id?: string | null;
  wise_transfer_id?: string | null;
  source_reference?: string | null;
  source_type?: string | null;
};

const IRREVERSIBLE_FOR_DELETE = new Set([
  'PAYMENT_CONFIRMED',
  'REFUND_CONFIRMED',
  'CRYPTO_PAYMENT_SUBMITTED',
]);

function amountReceivedPositive(amountReceived: unknown): boolean {
  if (amountReceived == null) return false;
  const n = Number(amountReceived);
  return Number.isFinite(n) && n > 0;
}

function hasGatewayOrReference(e: PaymentEventEvidenceFields): boolean {
  return Boolean(
    e.stripe_payment_intent_id ||
      e.hedera_transaction_id ||
      e.wise_transfer_id ||
      (typeof e.source_reference === 'string' && e.source_reference.trim().length > 0)
  );
}

/** Blocks permanent delete when any of these events exist (strict). */
export function paymentEventBlocksHardDelete(e: PaymentEventEvidenceFields): boolean {
  if (IRREVERSIBLE_FOR_DELETE.has(e.event_type)) return true;
  if (amountReceivedPositive(e.amount_received)) return true;
  return hasGatewayOrReference(e);
}

/**
 * Blocks “reopen to OPEN” when real settlement evidence exists.
 * Does not treat `source_type` alone as evidence (pilot rows may set provenance without money movement).
 */
export function paymentEventBlocksReopenAfterPaid(e: PaymentEventEvidenceFields): boolean {
  if (e.event_type === 'REFUND_CONFIRMED') return true;
  if (amountReceivedPositive(e.amount_received)) return true;
  if (e.event_type === 'PAYMENT_CONFIRMED') {
    return hasGatewayOrReference(e);
  }
  if (e.event_type === 'CRYPTO_PAYMENT_SUBMITTED') {
    return hasGatewayOrReference(e) || amountReceivedPositive(e.amount_received);
  }
  return hasGatewayOrReference(e);
}
