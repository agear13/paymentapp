'use client';

/**
 * Hackathon-only settlement release that persists funding and payout completion
 * through existing pilot APIs — no React state bypass.
 */

import { isHackathonJourneyEnabled } from '@/lib/journey/hackathon-journey';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import {
  refreshWorkflowObligations,
  type WorkflowObligationRow,
} from '@/lib/commercial/workflows/settlement-flow.client';
import { hackathonDemoFundingSourceReference } from '@/lib/payments/settlement-provider-refs';

export { isHackathonJourneyEnabled };

export function resolveWorkflowSettlementCurrency(
  obligations: WorkflowObligationRow[],
  fallback = 'AUD',
): string {
  if (isHackathonJourneyEnabled()) {
    return fallback.toUpperCase();
  }
  const fromObligation = obligations.find((row) => row.currency?.trim())?.currency?.trim();
  return (fromObligation || fallback).toUpperCase();
}

async function ensureHackathonDealFunding(input: {
  dealId: string;
  amount: number;
  currency: string;
}): Promise<void> {
  if (input.amount <= 0) return;

  const res = await csrfAwareFetch(
    `/api/deal-network-pilot/deals/${encodeURIComponent(input.dealId)}/payment-events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        mode: 'manual',
        amount: input.amount,
        currency: input.currency,
        sourceReference: hackathonDemoFundingSourceReference(input.dealId),
      }),
    },
  );

  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error || `Failed to record demo funding (${res.status})`);
  }
}

async function releaseHackathonSettlementBatch(input: {
  dealId: string;
  participantIds: string[];
}): Promise<void> {
  const res = await csrfAwareFetch(
    `/api/deal-network-pilot/deals/${encodeURIComponent(input.dealId)}/hackathon-settlement-release`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ participantIds: input.participantIds }),
    },
  );

  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      details?: unknown;
    };
    const detail =
      json.message ||
      (Array.isArray(json.details) ? JSON.stringify(json.details) : undefined) ||
      json.error ||
      `Hackathon settlement release failed (${res.status})`;
    throw new Error(detail);
  }
}

/**
 * Records demo funding, refreshes obligations, then persists payout completion
 * via the hackathon settlement release route.
 */
export async function executeHackathonWorkflowSettlementRelease(input: {
  dealId: string;
  currency: string;
  participantIds: string[];
  fundingAmount: number;
}): Promise<number> {
  if (!isHackathonJourneyEnabled()) {
    throw new Error('Hackathon settlement simulator is disabled');
  }
  if (input.participantIds.length === 0) return 0;

  await ensureHackathonDealFunding({
    dealId: input.dealId,
    amount: input.fundingAmount,
    currency: input.currency,
  });
  await refreshWorkflowObligations(input.dealId);
  await releaseHackathonSettlementBatch({
    dealId: input.dealId,
    participantIds: input.participantIds,
  });

  return input.participantIds.length;
}
