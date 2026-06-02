import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { hydrateOperationalParticipant } from '@/lib/operations/hydration/hydrate-operational-participant';
import {
  isOnboardingComplete,
  effectiveOnboardingStatus,
} from '@/lib/deal-network-demo/participant-onboarding';
import type {
  AllocationStatus,
  ParticipantCompensationProfile,
  ParticipantCompensationType,
  ParticipantPayoutDestinationStatus,
} from '@/lib/participants/participant-compensation-types';
import type { ParticipantReferralCommerce } from '@/lib/referrals/referral-commerce-config';
import type { ProjectParticipationModel } from '@/lib/projects/participant-entitlement';
import type { CommissionStructureKind } from '@/lib/deal-network-demo/commission-structure';
import {
  hasPersistedCompensationTerms,
  isParticipantCompensationExempt,
} from '@/lib/operations/primitives/participant-earnings-primitives';

export function isCompensationExempt(participant: DemoParticipant): boolean {
  return isParticipantCompensationExempt(participant);
}

/** Recognize compensation persisted on participant rows even when configured flag was not backfilled. */
export function inferCompensationConfiguredFromPersistence(
  participant: DemoParticipant
): boolean {
  return hasPersistedCompensationTerms(participant);
}

/** @deprecated Use isParticipantEarningsConfigured from participant-earnings-selectors */
export function isCompensationConfigured(participant: DemoParticipant): boolean {
  return inferCompensationConfiguredFromPersistence(participant);
}

export function deriveAllocationStatus(participant: DemoParticipant): AllocationStatus {
  if (isCompensationExempt(participant)) return 'exempt';
  if (isCompensationConfigured(participant)) return 'configured';
  return 'missing';
}

export function derivePayoutDestinationStatus(
  participant: DemoParticipant
): ParticipantPayoutDestinationStatus {
  if (isCompensationExempt(participant)) return 'configured';
  const hasEmail = Boolean(participant.email?.trim());
  const onboardingReady = isOnboardingComplete(effectiveOnboardingStatus(participant));
  if (hasEmail && onboardingReady) return 'configured';
  return 'not_configured';
}

export function inferCompensationTypeFromParticipant(
  participant: DemoParticipant
): ParticipantCompensationType {
  const existing = participant.compensationProfile?.compensationType;
  if (existing) return existing;
  if (participant.participationModel === 'revenue_share') return 'REVENUE_SHARE';
  if (participant.participationModel === 'customer_attribution') return 'COMMISSION';
  if (participant.participationModel === 'fixed_payout') return 'FIXED_FEE';
  if (participant.commissionKind === 'pct_deal_value') return 'REVENUE_SHARE';
  return 'FIXED_FEE';
}

/** Persist commercial terms from project invite when operator configured them at add time. */
export function buildInviteCompensationProfile(input: {
  participationModel: ProjectParticipationModel;
  commissionKind: CommissionStructureKind;
  commissionValue: number;
  enableCustomerAttribution: boolean;
  referralCommerce?: ParticipantReferralCommerce;
}): ParticipantCompensationProfile | undefined {
  const {
    participationModel,
    commissionValue,
    enableCustomerAttribution,
    referralCommerce,
  } = input;
  const configuredAt = new Date().toISOString();
  const attributionCommerce =
    referralCommerce?.commissionMode === 'referral_commerce' &&
    (participationModel === 'customer_attribution' || enableCustomerAttribution);

  if (attributionCommerce) {
    const pct = referralCommerce!.commerceCommissionPct ?? 10;
    const serviceIds = referralCommerce!.enabledServiceIds ?? [];
    return {
      compensationType: 'COMMISSION',
      percentage: pct,
      configured: true,
      configuredAt,
      customerAttributionEnabled: true,
      commissionSourceMode: serviceIds.length > 0 ? 'selected' : 'all_active',
      commissionServiceIds: serviceIds,
      revenueSources: [],
    };
  }

  if (participationModel === 'revenue_share' && commissionValue > 0) {
    return {
      compensationType: 'REVENUE_SHARE',
      percentage: commissionValue,
      configured: true,
      configuredAt,
      revenueSources: [],
    };
  }

  if (participationModel === 'fixed_payout' && commissionValue > 0) {
    return {
      compensationType: 'FIXED_FEE',
      fixedAmount: commissionValue,
      configured: true,
      configuredAt,
      revenueSources: [],
    };
  }

  return undefined;
}

export function defaultCompensationProfile(
  participant: DemoParticipant
): ParticipantCompensationProfile {
  const type = inferCompensationTypeFromParticipant(participant);
  return {
    compensationType: type,
    percentage:
      type === 'REVENUE_SHARE' || type === 'COMMISSION'
        ? participant.commissionValue || undefined
        : undefined,
    fixedAmount:
      type === 'FIXED_FEE' || type === 'REIMBURSEMENT'
        ? participant.commissionValue || undefined
        : undefined,
    revenueSources: [],
    configured: false,
  };
}

export function applyCompensationProfileToParticipant(
  participant: DemoParticipant,
  profile: ParticipantCompensationProfile
): DemoParticipant {
  const next: DemoParticipant = {
    ...participant,
    compensationProfile: {
      ...profile,
      configured: profile.exemptFromPayout ? true : profile.configured ?? true,
      configuredAt: profile.configuredAt ?? new Date().toISOString(),
    },
  };

  if (profile.exemptFromPayout || profile.compensationType === 'UNPAID_INTERNAL') {
    return next;
  }

  switch (profile.compensationType) {
    case 'REVENUE_SHARE':
    case 'COMMISSION':
      next.participationModel =
        profile.compensationType === 'COMMISSION' ? 'customer_attribution' : 'revenue_share';
      next.commissionKind = 'pct_deal_value';
      next.commissionValue = profile.percentage ?? 0;
      if (profile.compensationType === 'COMMISSION' && profile.configured) {
        next.compensationProfile = {
          ...next.compensationProfile!,
          customerAttributionEnabled: profile.customerAttributionEnabled ?? true,
        };
        if (profile.percentage != null && next.referralCommerce?.commissionMode === 'referral_commerce') {
          next.referralCommerce = {
            ...next.referralCommerce,
            commerceCommissionPct: profile.percentage,
          };
        }
      }
      break;
    case 'FIXED_FEE':
    case 'REIMBURSEMENT':
      next.participationModel = 'fixed_payout';
      next.commissionKind = 'fixed_amount';
      next.commissionValue = profile.fixedAmount ?? 0;
      break;
    case 'HYBRID':
      if (profile.customerAttributionEnabled === true && profile.percentage != null) {
        next.commissionKind = 'pct_deal_value';
        next.commissionValue = profile.percentage;
      } else if (profile.fixedAmount != null) {
        next.commissionKind = 'fixed_amount';
        next.commissionValue = profile.fixedAmount;
      } else {
        next.commissionValue = profile.percentage ?? profile.fixedAmount ?? next.commissionValue;
      }
      next.compensationProfile = {
        ...next.compensationProfile!,
        customerAttributionEnabled: profile.customerAttributionEnabled ?? false,
        commissionSourceMode: profile.commissionSourceMode ?? 'all_active',
        commissionServiceIds: profile.commissionServiceIds ?? [],
      };
      break;
    case 'CUSTOM':
      next.commissionValue = profile.percentage ?? profile.fixedAmount ?? next.commissionValue;
      break;
    default:
      break;
  }

  return next;
}

export type WorkspaceCompensationReadiness = {
  participantCount: number;
  configuredCount: number;
  participantsConfigured: boolean;
  unconfiguredParticipantIds: string[];
};

export function evaluateWorkspaceCompensationReadiness(
  participants: DemoParticipant[]
): WorkspaceCompensationReadiness {
  const active = participants
    .map((p) => hydrateOperationalParticipant(p))
    .filter((p) => p.name?.trim());
  const unconfigured = active.filter((p) => !isCompensationConfigured(p));
  const configuredCount = active.length - unconfigured.length;
  return {
    participantCount: active.length,
    configuredCount,
    participantsConfigured: active.length > 0 && unconfigured.length === 0,
    unconfiguredParticipantIds: unconfigured.map((p) => p.id),
  };
}
