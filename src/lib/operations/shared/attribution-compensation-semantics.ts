import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { ParticipantCompensationProfile } from '@/lib/participants/participant-compensation-types';

/** Compensation types that can use catalog-scoped customer purchase attribution. */
export function isAttributionCatalogCompensationType(compensationType?: string): boolean {
  return compensationType === 'COMMISSION' || compensationType === 'HYBRID';
}

function profileOf(participant: DemoParticipant): ParticipantCompensationProfile | undefined {
  return participant.compensationProfile;
}

/** Catalog-scoped commission: COMMISSION/HYBRID + attribution, or referral_commerce mode. */
export function isCatalogScopedCommission(participant: DemoParticipant): boolean {
  const profile = profileOf(participant);
  if (
    profile?.customerAttributionEnabled === true &&
    isAttributionCatalogCompensationType(profile.compensationType)
  ) {
    return true;
  }
  if (profile?.compensationType === 'COMMISSION' && profile.customerAttributionEnabled === true) {
    return true;
  }
  if (participant.referralCommerce?.commissionMode === 'referral_commerce') {
    return true;
  }
  return false;
}

export function isAllActiveCatalogSource(participant: DemoParticipant): boolean {
  const profile = profileOf(participant);
  if (profile?.commissionSourceMode === 'selected') return false;
  if (profile?.commissionSourceMode === 'all_active') return true;
  const commerce = participant.referralCommerce;
  if (commerce?.commissionMode === 'referral_commerce') {
    return !commerce.enabledServiceIds?.length;
  }
  return !profile?.commissionServiceIds?.length;
}

/** True when attribution + all-active catalog scope cannot be saved (empty active catalog). */
export function isAttributionAllActiveWithoutCatalog(input: {
  compensationType?: string;
  customerAttributionEnabled?: boolean;
  commissionSourceMode?: 'all_active' | 'selected';
  activeCatalogCount: number;
}): boolean {
  if (!isAttributionCatalogCompensationType(input.compensationType)) return false;
  if (input.customerAttributionEnabled !== true) return false;
  const mode = input.commissionSourceMode ?? 'all_active';
  if (mode !== 'all_active') return false;
  return input.activeCatalogCount === 0;
}
