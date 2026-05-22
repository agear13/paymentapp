/**
 * Canonical participant coordination lifecycle.
 * Transitions reflect explicit operator/participant actions — never inferred from creation alone.
 */

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

export const PARTICIPANT_LIFECYCLE_STATES = [
  'DRAFT',
  'READY_TO_INVITE',
  'INVITE_GENERATED',
  'INVITE_SENT',
  'INVITE_VIEWED',
  'PENDING_APPROVAL',
  'APPROVED',
  'ONBOARDING_REQUIRED',
  'PAYOUT_READY',
  'ACTIVE',
] as const;

export type ParticipantLifecycleState = (typeof PARTICIPANT_LIFECYCLE_STATES)[number];

export const PARTICIPANT_LIFECYCLE_TRANSITIONS: Record<
  ParticipantLifecycleState,
  readonly ParticipantLifecycleState[]
> = {
  DRAFT: ['READY_TO_INVITE'],
  READY_TO_INVITE: ['INVITE_GENERATED', 'DRAFT'],
  INVITE_GENERATED: ['INVITE_SENT', 'READY_TO_INVITE'],
  INVITE_SENT: ['INVITE_VIEWED', 'INVITE_GENERATED'],
  INVITE_VIEWED: ['PENDING_APPROVAL', 'APPROVED'],
  PENDING_APPROVAL: ['APPROVED', 'INVITE_VIEWED'],
  APPROVED: ['ONBOARDING_REQUIRED', 'PAYOUT_READY', 'ACTIVE'],
  ONBOARDING_REQUIRED: ['PAYOUT_READY', 'APPROVED'],
  PAYOUT_READY: ['ACTIVE', 'ONBOARDING_REQUIRED'],
  ACTIVE: ['ONBOARDING_REQUIRED'],
};

export const PARTICIPANT_LIFECYCLE_LABELS: Record<ParticipantLifecycleState, string> = {
  DRAFT: 'Participant added',
  READY_TO_INVITE: 'Ready to invite',
  INVITE_GENERATED: 'Agreement generated',
  INVITE_SENT: 'Agreement shared',
  INVITE_VIEWED: 'Agreement opened',
  PENDING_APPROVAL: 'Awaiting approval',
  APPROVED: 'Approved',
  ONBOARDING_REQUIRED: 'Payout onboarding required',
  PAYOUT_READY: 'Payout ready',
  ACTIVE: 'Active participant',
};

export const PARTICIPANT_LIFECYCLE_MEANING: Record<ParticipantLifecycleState, string> = {
  DRAFT: 'Participant record exists locally; no agreement prepared.',
  READY_TO_INVITE: 'Identity is sufficient to prepare an agreement link.',
  INVITE_GENERATED: 'Agreement link exists but has not been sent or shared.',
  INVITE_SENT: 'Operator explicitly sent or shared the agreement.',
  INVITE_VIEWED: 'Participant opened the agreement.',
  PENDING_APPROVAL: 'Participant action received; operator approval pending.',
  APPROVED: 'Operator approved this participant for coordination.',
  ONBOARDING_REQUIRED: 'Payout onboarding has not completed.',
  PAYOUT_READY: 'Payout destination and earnings are ready.',
  ACTIVE: 'Participant is operationally active on this project.',
};

export function deriveParticipantLifecycleState(
  participant: DemoParticipant
): ParticipantLifecycleState {
  if (participant.participantLifecycle) {
    return participant.participantLifecycle;
  }

  if (participant.approvalStatus === 'Approved') {
    const onboarding = participant.payoutOnboardingPhase ?? 'NOT_STARTED';
    if (onboarding === 'COMPLETED' || participant.onboardingStatus === 'COMPLETE') {
      return participant.payoutOnboardingPhase === 'COMPLETED' ? 'PAYOUT_READY' : 'ACTIVE';
    }
    return 'ONBOARDING_REQUIRED';
  }

  if (participant.agreementViewedAt || participant.inviteStatus === 'Opened') {
    return 'INVITE_VIEWED';
  }

  if (participant.inviteSentAt || participant.agreementSharedAt) {
    return 'INVITE_SENT';
  }

  if (participant.agreementUrl || participant.agreementLifecycle === 'GENERATED') {
    return 'INVITE_GENERATED';
  }

  if (participant.name?.trim() && (participant.email?.trim() || participant.inviteToken)) {
    return 'READY_TO_INVITE';
  }

  return 'DRAFT';
}

export function canTransitionParticipantLifecycle(
  from: ParticipantLifecycleState,
  to: ParticipantLifecycleState
): boolean {
  if (from === to) return true;
  return PARTICIPANT_LIFECYCLE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function participantLifecyclePrerequisites(state: ParticipantLifecycleState): string[] {
  switch (state) {
    case 'INVITE_GENERATED':
      return ['Participant identity configured'];
    case 'INVITE_SENT':
      return ['Agreement link generated', 'Explicit send or share action'];
    case 'INVITE_VIEWED':
      return ['Agreement shared', 'Participant opened agreement'];
    case 'APPROVED':
      return ['Agreement reviewed', 'Operator approval recorded'];
    case 'PAYOUT_READY':
      return ['Earnings configured', 'Payout onboarding complete'];
    default:
      return [];
  }
}

/** Apply agreement generated — link exists, not yet shared. */
export function applyParticipantAgreementGenerated(
  participant: DemoParticipant,
  agreementUrl: string
): DemoParticipant {
  return {
    ...participant,
    agreementUrl,
    agreementLifecycle: 'GENERATED',
    participantLifecycle: 'INVITE_GENERATED',
  };
}

/** Explicit operator share/copy/send. */
export function applyParticipantAgreementShared(participant: DemoParticipant): DemoParticipant {
  const now = new Date().toISOString();
  return {
    ...participant,
    agreementSharedAt: now,
    inviteSentAt: now,
    agreementLifecycle: 'SHARED',
    participantLifecycle: 'INVITE_SENT',
  };
}

export function applyParticipantAgreementViewed(participant: DemoParticipant): DemoParticipant {
  return {
    ...participant,
    agreementViewedAt: new Date().toISOString(),
    inviteStatus: 'Opened',
    participantLifecycle: 'INVITE_VIEWED',
    agreementLifecycle: 'VIEWED',
  };
}
