import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  effectiveOnboardingStatus,
  isOnboardingComplete,
  type PilotParticipantOnboardingStatus,
} from '@/lib/deal-network-demo/participant-onboarding';
import {
  deriveParticipantLifecycleState,
  PARTICIPANT_LIFECYCLE_LABELS,
  type ParticipantLifecycleState,
} from '@/lib/operations/lifecycle/participant-lifecycle';
import {
  derivePayoutOnboardingPhase,
  payoutOnboardingPlaceholderCopy,
  type PayoutOnboardingPhase,
} from '@/lib/operations/lifecycle/payout-lifecycle';
import { isParticipantOperationallyApproved } from '@/lib/operations/truth/participant-truth';
import { agreementTruthLabel } from '@/lib/operations/truth/agreement-truth';
import { attributionTruthLabel } from '@/lib/operations/truth/attribution-truth';
import { deriveAttributionStatus, type ParticipantAttributionStatus } from '@/lib/projects/participant-entitlement';
import { canGenerateAttributionLink } from '@/lib/operations/truth/attribution-truth';

/** @deprecated Use ParticipantLifecycleState — kept for table column compatibility */
export type ParticipantInviteState =
  | 'draft'
  | 'ready'
  | 'generated'
  | 'sent'
  | 'opened'
  | 'approved';

export type ParticipantParticipationLabel =
  | 'added'
  | 'ready to invite'
  | 'awaiting approval'
  | 'approved';

/** Payout profile readiness — separate from attribution. */
export type PayoutOnboardingState = 'not started' | 'invited' | 'in progress' | 'ready' | 'blocked';

function lifecycleToInviteState(state: ParticipantLifecycleState): ParticipantInviteState {
  switch (state) {
    case 'DRAFT':
    case 'READY_TO_INVITE':
      return state === 'DRAFT' ? 'draft' : 'ready';
    case 'INVITE_GENERATED':
      return 'generated';
    case 'INVITE_SENT':
      return 'sent';
    case 'INVITE_VIEWED':
    case 'PENDING_APPROVAL':
      return 'opened';
    case 'APPROVED':
    case 'ONBOARDING_REQUIRED':
    case 'PAYOUT_READY':
    case 'ACTIVE':
      return 'approved';
    default:
      return 'draft';
  }
}

export function deriveInviteState(participant: DemoParticipant): ParticipantInviteState {
  return lifecycleToInviteState(deriveParticipantLifecycleState(participant));
}

export function inviteStateLabel(state: ParticipantInviteState): string {
  switch (state) {
    case 'approved':
      return 'Approved';
    case 'opened':
      return 'Agreement opened';
    case 'sent':
      return 'Agreement shared';
    case 'generated':
      return 'Agreement ready';
    case 'ready':
      return 'Ready to invite';
    default:
      return 'Participant added';
  }
}

export function deriveParticipationLabel(
  participant: DemoParticipant
): ParticipantParticipationLabel {
  if (isParticipantOperationallyApproved(participant)) return 'approved';
  const lifecycle = deriveParticipantLifecycleState(participant);
  if (lifecycle === 'INVITE_VIEWED' || lifecycle === 'PENDING_APPROVAL') {
    return 'awaiting approval';
  }
  if (lifecycle === 'READY_TO_INVITE' || lifecycle === 'INVITE_GENERATED') {
    return 'ready to invite';
  }
  return 'added';
}

export function participationLabelText(label: ParticipantParticipationLabel): string {
  switch (label) {
    case 'approved':
      return 'Approved';
    case 'awaiting approval':
      return 'Awaiting approval';
    case 'ready to invite':
      return 'Ready to invite';
    default:
      return 'Participant added';
  }
}

export function derivePayoutOnboardingState(
  participant: DemoParticipant
): PayoutOnboardingState {
  if (participant.payoutBlocked) return 'blocked';
  const phase = derivePayoutOnboardingPhase(participant);
  if (phase === 'COMPLETED' || isOnboardingComplete(effectiveOnboardingStatus(participant))) {
    return 'ready';
  }
  if (phase === 'IN_PROGRESS') return 'in progress';
  if (phase === 'INVITED') return 'invited';
  return 'not started';
}

export function payoutOnboardingLabel(state: PayoutOnboardingState): string {
  switch (state) {
    case 'ready':
      return 'Complete';
    case 'in progress':
      return 'In progress';
    case 'invited':
      return 'Invited';
    case 'blocked':
      return 'Blocked';
    default:
      return 'Not started';
  }
}

export function payoutOnboardingOperatorCopy(participant: DemoParticipant): string {
  return payoutOnboardingPlaceholderCopy(derivePayoutOnboardingPhase(participant));
}

export function participantLifecycleDisplayLabel(participant: DemoParticipant): string {
  return PARTICIPANT_LIFECYCLE_LABELS[deriveParticipantLifecycleState(participant)];
}

export function agreementDisplayLabel(participant: DemoParticipant): string {
  return agreementTruthLabel(participant);
}

export function attributionDisplayLabel(participant: DemoParticipant): string {
  return attributionTruthLabel(participant);
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
    const lifecycle = deriveParticipantLifecycleState(p);
    if (
      lifecycle !== 'APPROVED' &&
      lifecycle !== 'PAYOUT_READY' &&
      lifecycle !== 'ACTIVE' &&
      lifecycle !== 'ONBOARDING_REQUIRED'
    ) {
      pendingAgreements += 1;
    }
    const payoutOb = derivePayoutOnboardingState(p);
    if (payoutOb === 'in progress' || payoutOb === 'not started' || payoutOb === 'invited') {
      if (isParticipantOperationallyApproved(p)) missingOnboarding += 1;
    }
    if (payoutOb === 'ready' && isParticipantOperationallyApproved(p)) readyForPayout += 1;
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
      payoutOnboardingPhase: 'IN_PROGRESS',
    };
  }
  const phase: PayoutOnboardingPhase =
    value === 'COMPLETE' ? 'COMPLETED' : value === 'INCOMPLETE' ? 'IN_PROGRESS' : 'NOT_STARTED';
  return {
    ...participant,
    payoutBlocked: false,
    onboardingStatus: value,
    payoutOnboardingPhase: phase,
  };
}

export function referralIssuanceFromParticipant(
  participant: DemoParticipant
): { code: string; referralUrl: string } | null {
  if (!canGenerateAttributionLink(participant)) return null;
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
