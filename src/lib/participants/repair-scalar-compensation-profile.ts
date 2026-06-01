import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { hasPersistedCompensationTerms } from '@/lib/operations/primitives/participant-earnings-primitives';
import type { ParticipantCompensationProfile } from '@/lib/participants/participant-compensation-types';

/** AI-import / legacy rows that saved commission scalars without compensationProfile. */
export function needsScalarRevenueShareProfileRepair(
  participant: DemoParticipant
): boolean {
  if (hasPersistedCompensationTerms(participant)) return false;
  const commissionValue = participant.commissionValue;
  if (!Number.isFinite(commissionValue) || commissionValue <= 0) return false;
  return (
    participant.participationModel === 'revenue_share' ||
    participant.commissionKind === 'pct_deal_value'
  );
}

/** Backfill REVENUE_SHARE profile from persisted commission scalars (runtime repair). */
export function repairScalarCompensationProfile(participant: DemoParticipant): {
  participant: DemoParticipant;
  repaired: boolean;
} {
  if (!needsScalarRevenueShareProfileRepair(participant)) {
    return { participant, repaired: false };
  }
  const configuredAt = new Date().toISOString();
  const profile: ParticipantCompensationProfile = {
    compensationType: 'REVENUE_SHARE',
    percentage: participant.commissionValue,
    configured: true,
    configuredAt,
    revenueSources: [],
  };
  return {
    participant: {
      ...participant,
      participationModel: 'revenue_share',
      commissionKind: 'pct_deal_value',
      commissionValue: participant.commissionValue,
      compensationProfile: profile,
    },
    repaired: true,
  };
}
