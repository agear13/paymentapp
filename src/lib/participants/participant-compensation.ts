import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
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

export function isCompensationExempt(participant: DemoParticipant): boolean {
  const profile = participant.compensationProfile;
  return Boolean(
    profile?.exemptFromPayout ||
      profile?.compensationType === 'UNPAID_INTERNAL'
  );
}

export function isCompensationConfigured(participant: DemoParticipant): boolean {
  if (isCompensationExempt(participant)) return true;
  const profile = participant.compensationProfile;
  if (profile?.configured === true) return true;
  return false;
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
  const active = participants.filter((p) => p.name?.trim());
  const unconfigured = active.filter((p) => !isCompensationConfigured(p));
  const configuredCount = active.length - unconfigured.length;
  return {
    participantCount: active.length,
    configuredCount,
    participantsConfigured: active.length > 0 && unconfigured.length === 0,
    unconfiguredParticipantIds: unconfigured.map((p) => p.id),
  };
}
