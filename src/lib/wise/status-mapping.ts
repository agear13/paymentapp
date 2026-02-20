/**
 * Map Wise transfer/quote statuses to internal payment link statuses.
 * Used by webhook and polling to update payment link state.
 */

export type InternalPaymentStatus = 'PENDING' | 'PAID' | 'FAILED';

/** Wise transfer statuses (from API) – normalize to lowercase for mapping */
const WISE_PAID_STATUSES = new Set([
  'outgoing_payment_sent',
  'funded',
  'paid',
  'completed',
  'credited',
  'delivered',
]);

const WISE_FAILED_STATUSES = new Set([
  'cancelled',
  'failed',
  'rejected',
  'refunded',
  'expired',
]);

/**
 * Map Wise status string to internal status.
 * created/pending/incoming_payment_waiting etc → PENDING
 * funded/paid/outgoing_payment_sent/completed → PAID
 * cancelled/failed/rejected → FAILED
 */
export function mapWiseStatusToInternal(wiseStatus: string | null | undefined): InternalPaymentStatus {
  if (!wiseStatus || typeof wiseStatus !== 'string') {
    return 'PENDING';
  }
  const normalized = wiseStatus.toLowerCase().trim();
  if (WISE_PAID_STATUSES.has(normalized)) {
    return 'PAID';
  }
  if (WISE_FAILED_STATUSES.has(normalized)) {
    return 'FAILED';
  }
  return 'PENDING';
}
