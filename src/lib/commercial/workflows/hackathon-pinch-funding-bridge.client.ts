'use client';

/**
 * Hackathon-only bridge: real Pinch sandbox payment → pilot payment_events funding.
 * Remove after hackathon demo — Stage 6 settlement expects Provvy-side funding rows.
 */

import { isHackathonJourneyEnabled } from '@/lib/journey/hackathon-journey';
import type { PinchCreatePaymentResponse } from '@/lib/payments/pinch/payment-service';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';

export function hackathonPinchPaymentSourceReference(paymentId: string): string {
  return `pinch:${paymentId}`;
}

export async function bridgeHackathonPinchPaymentToPilotFunding(input: {
  dealId: string;
  payment: PinchCreatePaymentResponse;
}): Promise<void> {
  if (!isHackathonJourneyEnabled()) {
    return;
  }

  const dealId = input.dealId.trim();
  if (!dealId) {
    throw new Error('Cannot record Pinch funding — deal id is missing');
  }

  const paymentId = input.payment.id?.trim();
  if (!paymentId) {
    throw new Error('Pinch payment response did not include an id');
  }

  const amountCents = input.payment.amount;
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error('Pinch payment response did not include a valid amount');
  }

  const currency = input.payment.currency?.trim() || 'AUD';

  const res = await csrfAwareFetch(
    `/api/deal-network-pilot/deals/${encodeURIComponent(dealId)}/payment-events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        mode: 'manual',
        amount: amountCents / 100,
        currency,
        sourceReference: hackathonPinchPaymentSourceReference(paymentId),
      }),
    },
  );

  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(
      json.error ||
        json.message ||
        `Failed to record Pinch payment for settlement (${res.status})`,
    );
  }
}
