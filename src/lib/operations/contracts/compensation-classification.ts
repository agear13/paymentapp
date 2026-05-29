import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { ParticipantCompensationProfile } from '@/lib/participants/participant-compensation-types';
import { isCatalogScopedCommission } from '@/lib/operations/derivations/commission-scope';
import { hasPersistedCompensationTerms } from '@/lib/operations/primitives/participant-earnings-primitives';

/** Explicit compensation classifications — prevents semantic ambiguity across surfaces. */
export const COMPENSATION_CLASSIFICATIONS = [
  'PROJECT_REVENUE_SHARE',
  'FIXED_PROJECT_PAYOUT',
  'SERVICE_COMMISSION',
  'ATTRIBUTED_REFERRAL_COMMISSION',
  'UNCONFIGURED',
] as const;

export type CompensationClassification = (typeof COMPENSATION_CLASSIFICATIONS)[number];

export const COMPENSATION_CLASSIFICATION_LABELS: Record<CompensationClassification, string> = {
  PROJECT_REVENUE_SHARE: 'Project revenue share (settlement allocation)',
  FIXED_PROJECT_PAYOUT: 'Fixed project payout',
  SERVICE_COMMISSION: 'Service commission (catalog items, no attribution)',
  ATTRIBUTED_REFERRAL_COMMISSION: 'Attributed referral commission (customer checkout)',
  UNCONFIGURED: 'Compensation not configured',
};

export function classifyParticipantCompensation(
  participant: DemoParticipant
): CompensationClassification {
  const profile = participant.compensationProfile;
  if (!profile || !hasPersistedCompensationTerms(participant)) return 'UNCONFIGURED';

  if (
    profile.compensationType === 'REVENUE_SHARE' ||
    participant.participationModel === 'revenue_share' ||
    participant.commissionKind === 'pct_deal_value'
  ) {
    if (isCatalogScopedCommission(participant) && profile.customerAttributionEnabled) {
      return 'ATTRIBUTED_REFERRAL_COMMISSION';
    }
    return 'PROJECT_REVENUE_SHARE';
  }

  if (
    profile.compensationType === 'FIXED_FEE' ||
    participant.participationModel === 'fixed_payout' ||
    participant.commissionKind === 'fixed_amount'
  ) {
    return 'FIXED_PROJECT_PAYOUT';
  }

  if (profile.customerAttributionEnabled === true && isCatalogScopedCommission(participant)) {
    return 'ATTRIBUTED_REFERRAL_COMMISSION';
  }

  if (profile.compensationType === 'COMMISSION' || isCatalogScopedCommission(participant)) {
    return 'SERVICE_COMMISSION';
  }

  return 'UNCONFIGURED';
}

export function compensationRequiresAttribution(classification: CompensationClassification): boolean {
  return classification === 'ATTRIBUTED_REFERRAL_COMMISSION';
}

export function compensationGeneratesObligations(classification: CompensationClassification): boolean {
  return classification !== 'UNCONFIGURED';
}

export function normalizeProfileClassification(
  participant: DemoParticipant,
  profile: ParticipantCompensationProfile
): ParticipantCompensationProfile {
  const classification = classifyParticipantCompensation({ ...participant, compensationProfile: profile });
  if (classification === 'PROJECT_REVENUE_SHARE' || classification === 'FIXED_PROJECT_PAYOUT') {
    return {
      ...profile,
      customerAttributionEnabled: false,
      commissionServiceIds: [],
    };
  }
  if (classification === 'ATTRIBUTED_REFERRAL_COMMISSION') {
    return { ...profile, customerAttributionEnabled: true };
  }
  return profile;
}
