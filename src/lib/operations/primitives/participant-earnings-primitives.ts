import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  isAllActiveCatalogSource,
  isCatalogScopedCommission,
} from '@/lib/operations/shared/attribution-compensation-semantics';

/** Persisted entity only — no hydration, selectors, lifecycle, or diagnostics. */
export function isParticipantCompensationExempt(
  participant: DemoParticipant | null | undefined
): boolean {
  if (!participant) return false;
  const profile = participant.compensationProfile;
  return Boolean(profile?.exemptFromPayout || profile?.compensationType === 'UNPAID_INTERNAL');
}

/** Recognize compensation persisted on participant rows even when configured flag was not backfilled. */
export function hasPersistedCompensationTerms(
  participant: DemoParticipant | null | undefined
): boolean {
  if (!participant) return false;
  if (isParticipantCompensationExempt(participant)) return true;
  const profile = participant.compensationProfile;
  if (!profile) return false;
  if (profile.configured === true) return true;
  if (profile.configuredAt) return true;
  const hasProfileAmount =
    (profile.fixedAmount != null && profile.fixedAmount > 0) ||
    (profile.percentage != null && profile.percentage > 0);
  if (profile.compensationType && hasProfileAmount) return true;
  if (
    profile.compensationType &&
    Number.isFinite(participant.commissionValue) &&
    participant.commissionValue > 0
  ) {
    return true;
  }
  if (
    profile.compensationType &&
    (profile.commissionServiceIds?.length ?? 0) > 0 &&
    (profile.customerAttributionEnabled === true || profile.commissionSourceMode === 'selected')
  ) {
    return true;
  }
  return false;
}

export function hasApprovedAgreement(
  participant: DemoParticipant | null | undefined
): boolean {
  if (!participant) return false;
  if (participant.approvalStatus === 'Approved') return true;
  if (
    (participant as DemoParticipant & { approval_status?: string }).approval_status === 'Approved'
  ) {
    return true;
  }
  if (participant.agreementLifecycle === 'APPROVED') return true;
  const lifecycle = participant.participantLifecycle;
  return lifecycle === 'APPROVED' || lifecycle === 'PAYOUT_READY' || lifecycle === 'ACTIVE';
}

export function hasConfirmedPayout(
  participant: DemoParticipant | null | undefined
): boolean {
  if (!participant) return false;
  if (participant.compensationProfile?.exemptFromPayout) return true;
  return participant.payoutVerificationConfirmed === true;
}

export function hasPersistedAttributionEnabled(
  participant: DemoParticipant | null | undefined
): boolean {
  if (!participant) return false;
  return (
    participant.compensationProfile?.customerAttributionEnabled === true ||
    participant.participationModel === 'customer_attribution'
  );
}

export function hasPersistedAttributionLinkEligibility(
  participant: DemoParticipant,
  context: { catalogItems?: Array<{ id: string }> } = {}
): boolean {
  if (!hasPersistedAttributionEnabled(participant)) return false;
  if (!isCatalogScopedCommission(participant)) return false;
  if (participant.referralCommerce?.createReferralLink === false) return false;
  if (isAllActiveCatalogSource(participant)) {
    return (context.catalogItems?.length ?? 0) > 0;
  }
  const ids = participant.compensationProfile?.commissionServiceIds ?? [];
  if (ids.length === 0) return false;
  if (!context.catalogItems?.length) return true;
  const idSet = new Set(ids);
  return context.catalogItems.some((item) => idSet.has(item.id));
}

export function hasActiveAttributionTracking(
  participant: DemoParticipant,
  context: { catalogItems?: Array<{ id: string }> } = {}
): boolean {
  if (!hasPersistedAttributionLinkEligibility(participant, context)) return false;
  if (!hasApprovedAgreement(participant)) return false;
  return (
    participant.attributionStatus === 'active' ||
    Boolean(participant.customerCommerceUrl?.trim())
  );
}

export function hasPersistedPayoutReadyForKpi(participant: DemoParticipant): boolean {
  if (participant.payoutBlocked) return false;
  if (!hasPersistedCompensationTerms(participant)) return false;
  if (!hasApprovedAgreement(participant)) return false;
  return hasConfirmedPayout(participant);
}

export function countPersistedEarningsConfigured(participants: DemoParticipant[]): number {
  return participants.filter(
    (p) =>
      p != null &&
      (hasPersistedCompensationTerms(p) || isParticipantCompensationExempt(p))
  ).length;
}

export function countPersistedPayoutReadyForKpi(participants: DemoParticipant[]): number {
  return participants.filter((p) => p != null && hasPersistedPayoutReadyForKpi(p)).length;
}
