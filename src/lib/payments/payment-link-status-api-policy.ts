/**
 * Policy for POST /api/payment-links/[id]/status (R2).
 * Settlement truth (PAID) must not be set via this API — use confirmPayment() or dedicated flows.
 */

import type { PaymentLinkStatus } from '@prisma/client';
import { getValidNextStates } from '@/lib/payments/state-machine';

export const PAID_TRANSITION_BLOCKED_CODE = 'PAID_TRANSITION_REQUIRES_SETTLEMENT' as const;

/** Status values that must only be reached through canonical settlement or dedicated review routes. */
export const STATUSES_BLOCKED_VIA_STATUS_API: ReadonlySet<PaymentLinkStatus> = new Set([
  'PAID',
]);

export type PaidTransitionBlockedPayload = {
  error: string;
  code: typeof PAID_TRANSITION_BLOCKED_CODE;
  attemptedTransition: { from: PaymentLinkStatus; to: 'PAID' };
  validTransitions: PaymentLinkStatus[];
  canonicalSettlement: {
    summary: string;
    automatedRails: string[];
    operatorFlows: string[];
  };
};

export function isStatusBlockedViaStatusApi(
  targetStatus: PaymentLinkStatus
): targetStatus is 'PAID' {
  return STATUSES_BLOCKED_VIA_STATUS_API.has(targetStatus);
}

/** Next states allowed through the status API (excludes settlement-only targets). */
export function getStatusApiAllowedNextStates(
  from: PaymentLinkStatus
): PaymentLinkStatus[] {
  return getValidNextStates(from).filter((s) => !STATUSES_BLOCKED_VIA_STATUS_API.has(s));
}

export function buildPaidTransitionBlockedPayload(
  from: PaymentLinkStatus
): PaidTransitionBlockedPayload {
  return {
    error:
      'Transition to PAID is not allowed via the status API. Invoice settlement must run through payment confirmation (PAYMENT_CONFIRMED + ledger) or the dedicated operator/review endpoints.',
    code: PAID_TRANSITION_BLOCKED_CODE,
    attemptedTransition: { from, to: 'PAID' },
    validTransitions: getStatusApiAllowedNextStates(from),
    canonicalSettlement: {
      summary:
        'PAID requires a PAYMENT_CONFIRMED payment event created by confirmPayment() (Stripe, Wise, Hedera webhooks/pollers) or an approved manual flow — not a raw status change.',
      automatedRails: [
        'Stripe: payment_intent.succeeded / checkout.session.completed → confirmPayment()',
        'Wise: funded transfer webhook → confirmPayment()',
        'Hedera: POST /api/hedera/confirm or transaction-checker → confirmPayment()',
      ],
      operatorFlows: [
        'Operator mark paid: POST /api/payment-links/[id]/manual-settlement (action: mark_paid)',
        'Manual bank approval: POST /api/payment-links/manual-bank-confirmations/[id]/review (mark_valid)',
        'Crypto approval: POST /api/payment-links/crypto-confirmations/[id]/review (mark_valid)',
        'Repair missed Stripe settlement: POST /api/jobs/stripe-reconciliation or repair scripts',
      ],
    },
  };
}
