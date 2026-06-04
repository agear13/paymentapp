import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  hasPersistedCompensationTerms,
  isParticipantCompensationExempt,
} from '@/lib/operations/primitives/participant-earnings-primitives';

/**
 * How participant earnings settle — project obligations vs per-purchase commission rows.
 * Derived from compensationProfile, not from commissionKind scalars.
 */
export type CompensationSettlementBasis = 'PROJECT_OBLIGATION' | 'ATTRIBUTION_COMMISSION';

/**
 * Customer attribution / catalog commission — source of truth is commission_obligation_items
 * created at payment settlement, not deal.value projections.
 */
export function usesAttributionCommissionSettlement(participant: DemoParticipant): boolean {
  const profile = participant.compensationProfile;
  if (isParticipantCompensationExempt(participant)) return false;
  if (!hasPersistedCompensationTerms(participant)) return false;
  return (
    profile?.compensationType === 'COMMISSION' && profile.customerAttributionEnabled === true
  );
}

/** Project-scoped obligations (revenue share, fixed fee, milestones, hybrid project slice). */
export function usesProjectObligationSettlement(participant: DemoParticipant): boolean {
  if (isParticipantCompensationExempt(participant)) return false;
  if (!hasPersistedCompensationTerms(participant)) return false;
  return !usesAttributionCommissionSettlement(participant);
}

export function deriveCompensationSettlementBasis(
  participant: DemoParticipant
): CompensationSettlementBasis {
  return usesAttributionCommissionSettlement(participant)
    ? 'ATTRIBUTION_COMMISSION'
    : 'PROJECT_OBLIGATION';
}
