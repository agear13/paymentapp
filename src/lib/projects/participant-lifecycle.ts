import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  effectiveOnboardingStatus,
  isOnboardingComplete,
  type PilotParticipantOnboardingStatus,
} from '@/lib/deal-network-demo/participant-onboarding';
import {
  deriveAttributionStatus,
  type ParticipantAttributionStatus,
} from '@/lib/projects/participant-entitlement';

/** Invite delivery / agreement progress (operator view). */
export type ParticipantInviteState = 'sent' | 'opened' | 'approved';

export type ParticipantParticipationLabel = 'pending approval' | 'approved';

/** Payout profile readiness — separate from attribution. */
export type PayoutOnboardingState = 'not started' | 'incomplete' | 'ready' | 'blocked';

export function deriveInviteState(participant: DemoParticipant): ParticipantInviteState {
  if (participant.approvalStatus === 'Approved') return 'approved';
  if (participant.inviteStatus === 'Opened') return 'opened';
  return 'sent';
}

export function inviteStateLabel(state: ParticipantInviteState): string {
  switch (state) {
    case 'approved':
      return 'Approved';
    case 'opened':
      return 'Opened';
    default:
      return 'Sent';
  }
}

export function deriveParticipationLabel(
  participant: DemoParticipant
): ParticipantParticipationLabel {
  return participant.approvalStatus === 'Approved' ? 'approved' : 'pending approval';
}

export function participationLabelText(label: ParticipantParticipationLabel): string {
  return label === 'approved' ? 'Approved' : 'Pending approval';
}

export function derivePayoutOnboardingState(
  participant: DemoParticipant
): PayoutOnboardingState {
  if (participant.payoutBlocked) return 'blocked';
  const onboarding = effectiveOnboardingStatus(participant);
  if (isOnboardingComplete(onboarding)) return 'ready';
  if (onboarding === 'INCOMPLETE') return 'incomplete';
  return 'not started';
}

export function payoutOnboardingLabel(state: PayoutOnboardingState): string {
  switch (state) {
    case 'ready':
      return 'Ready';
    case 'incomplete':
      return 'Incomplete';
    case 'blocked':
      return 'Blocked';
    default:
      return 'Not started';
  }
}

export type ParticipantSummaryMetrics = {
  total: number;
  pendingAgreements: number;
  missingOnboarding: number;
  readyForPayout: number;
  activeAttribution: number;
};

export function participantSummaryMetrics(
  participants: DemoParticipant[]
): ParticipantSummaryMetrics {
  let pendingAgreements = 0;
  let missingOnboarding = 0;
  let readyForPayout = 0;
  let activeAttribution = 0;

  for (const p of participants) {
    if (p.approvalStatus !== 'Approved') pendingAgreements += 1;
    const payoutOb = derivePayoutOnboardingState(p);
    if (payoutOb === 'incomplete' || payoutOb === 'not started' || payoutOb === 'blocked') {
      if (p.approvalStatus === 'Approved') missingOnboarding += 1;
    }
    if (payoutOb === 'ready' && p.approvalStatus === 'Approved') readyForPayout += 1;
    if (deriveAttributionStatus(p) === 'active') activeAttribution += 1;
  }

  return {
    total: participants.length,
    pendingAgreements,
    missingOnboarding,
    readyForPayout,
    activeAttribution,
  };
}

export function onboardingSelectValue(
  participant: DemoParticipant
): PilotParticipantOnboardingStatus | 'BLOCKED' {
  if (participant.payoutBlocked) return 'BLOCKED';
  return effectiveOnboardingStatus(participant);
}

export function applyOnboardingSelectValue(
  participant: DemoParticipant,
  value: PilotParticipantOnboardingStatus | 'BLOCKED'
): DemoParticipant {
  if (value === 'BLOCKED') {
    return {
      ...participant,
      payoutBlocked: true,
      onboardingStatus: 'INCOMPLETE',
    };
  }
  return {
    ...participant,
    payoutBlocked: false,
    onboardingStatus: value,
  };
}

export function referralIssuanceFromParticipant(
  participant: DemoParticipant
): { code: string; referralUrl: string } | null {
  const url =
    participant.customerCommerceUrl?.trim() ||
    participant.inviteLink?.trim() ||
    '';
  if (!url) return null;
  if (participant.referralCode?.trim()) {
    return { referralUrl: url, code: participant.referralCode.trim().toUpperCase() };
  }
  const codeMatch = url.match(/\/r\/([A-Z0-9_-]+)/i) ?? url.match(/\/ref\/([a-z0-9_-]+)/i);
  return {
    referralUrl: url,
    code: codeMatch?.[1]?.toUpperCase() ?? 'LINK',
  };
}

export function isAttributionActive(status: ParticipantAttributionStatus): boolean {
  return status === 'active' || status === 'generating conversions';
}
