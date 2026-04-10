import type { DealStatus, RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

export type ParticipantPayoutSettlementStatus = 'Pending' | 'Eligible' | 'Approved' | 'Paid';

export function coerceDealStatusToPayout(s: DealStatus): ParticipantPayoutSettlementStatus {
  if (s === 'Pending' || s === 'Eligible' || s === 'Approved' || s === 'Paid') return s;
  return 'Pending';
}

/** Per-participant payout line status; falls back to deal settlement when unset. */
export function effectiveParticipantPayoutStatus(
  p: DemoParticipant,
  deal: RecentDeal
): ParticipantPayoutSettlementStatus {
  if (p.payoutSettlementStatus) return p.payoutSettlementStatus;
  return coerceDealStatusToPayout(deal.status);
}
