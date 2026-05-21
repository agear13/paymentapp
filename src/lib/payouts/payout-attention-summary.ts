import {
  isApprovedButNotOnboarded,
} from '@/lib/deal-network-demo/participant-onboarding';
import type { DealNetworkPilotObligationStatus } from '@prisma/client';

export type ObligationRowLike = {
  status: DealNetworkPilotObligationStatus | string;
  amount_owed: unknown;
  currency: string;
  obligation_type: string;
  participant?: {
    id: string;
    approvalStatus?: string;
    onboardingStatus?: string;
  } | null;
};

function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : 0;
}

export type PayoutAttentionSummary = {
  unfundedCount: number;
  awaitingOnboardingCount: number;
  readyForReleaseCount: number;
  readyForReleaseAmount: number;
  primaryCurrency: string | null;
};

export function computePayoutAttentionSummary(
  rows: ObligationRowLike[]
): PayoutAttentionSummary {
  let unfundedCount = 0;
  let awaitingOnboardingCount = 0;
  let readyForReleaseCount = 0;
  let readyForReleaseAmount = 0;
  const currencies = new Set<string>();

  for (const row of rows) {
    const status = row.status as DealNetworkPilotObligationStatus;
    const code = (row.currency || '').trim().toUpperCase();
    if (code.length === 3) currencies.add(code);

    if (status === 'UNFUNDED' || status === 'PARTIALLY_FUNDED') {
      unfundedCount++;
    }

    if (
      status === 'APPROVED' &&
      row.participant &&
      row.obligation_type !== 'PLATFORM_FEE' &&
      isApprovedButNotOnboarded({
        id: row.participant.id,
        approvalStatus:
          row.participant.approvalStatus === 'Approved' ? 'Approved' : 'Pending approval',
        onboardingStatus: row.participant.onboardingStatus,
      })
    ) {
      awaitingOnboardingCount++;
    } else if (
      status === 'APPROVED' &&
      row.participant?.onboardingStatus &&
      row.participant.onboardingStatus !== 'Complete'
    ) {
      awaitingOnboardingCount++;
    }

    if (status === 'AVAILABLE_FOR_PAYOUT') {
      readyForReleaseCount++;
      readyForReleaseAmount += toNumber(row.amount_owed);
    }
  }

  return {
    unfundedCount,
    awaitingOnboardingCount,
    readyForReleaseCount,
    readyForReleaseAmount,
    primaryCurrency: currencies.size === 1 ? [...currencies][0]! : null,
  };
}

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  if (diffMs < 60_000) return 'Just now';
  if (diffMs < 3_600_000) {
    const m = Math.floor(diffMs / 60_000);
    return `${m}m ago`;
  }
  if (diffMs < 86_400_000) {
    const h = Math.floor(diffMs / 3_600_000);
    return `${h}h ago`;
  }
  const d = Math.floor(diffMs / 86_400_000);
  if (d < 14) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
