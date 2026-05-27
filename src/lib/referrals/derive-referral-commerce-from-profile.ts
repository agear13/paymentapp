import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { isAttributionCatalogCompensationType } from '@/lib/operations/truth/attribution-eligibility';
import {
  defaultReferralCommerce,
  normalizeReferralCommerce,
  type ParticipantReferralCommerce,
} from '@/lib/referrals/referral-commerce-config';

/** Canonical referral commerce projection from compensation profile (COMMISSION + HYBRID attribution). */
export function deriveReferralCommerceFromCompensationProfile(
  participant: DemoParticipant
): ParticipantReferralCommerce | null {
  const profile = participant.compensationProfile;
  if (profile?.customerAttributionEnabled !== true) return null;
  if (!isAttributionCatalogCompensationType(profile.compensationType)) return null;

  const pct = profile.percentage ?? participant.commissionValue;
  const selectedIds =
    profile.commissionSourceMode === 'selected' ? (profile.commissionServiceIds ?? []) : [];

  return normalizeReferralCommerce({
    ...defaultReferralCommerce(),
    commissionMode: 'referral_commerce',
    commerceCommissionPct: Number.isFinite(pct) ? (pct as number) : 10,
    enabledServiceIds: selectedIds,
    createReferralLink: true,
  });
}
