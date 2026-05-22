import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

export const AGREEMENT_LIFECYCLE_STATES = [
  'NOT_CREATED',
  'DRAFTED',
  'GENERATED',
  'SHARED',
  'VIEWED',
  'SIGNED',
  'APPROVED',
] as const;

export type AgreementLifecycleState = (typeof AGREEMENT_LIFECYCLE_STATES)[number];

export const AGREEMENT_LIFECYCLE_TRANSITIONS: Record<
  AgreementLifecycleState,
  readonly AgreementLifecycleState[]
> = {
  NOT_CREATED: ['DRAFTED', 'GENERATED'],
  DRAFTED: ['GENERATED', 'NOT_CREATED'],
  GENERATED: ['SHARED', 'DRAFTED'],
  SHARED: ['VIEWED', 'GENERATED'],
  VIEWED: ['SIGNED', 'APPROVED', 'SHARED'],
  SIGNED: ['APPROVED', 'VIEWED'],
  APPROVED: ['SIGNED'],
};

export const AGREEMENT_LIFECYCLE_LABELS: Record<AgreementLifecycleState, string> = {
  NOT_CREATED: 'Agreement not generated',
  DRAFTED: 'Agreement draft',
  GENERATED: 'Agreement link ready',
  SHARED: 'Agreement shared',
  VIEWED: 'Agreement viewed',
  SIGNED: 'Agreement signed',
  APPROVED: 'Agreement approved',
};

export const AGREEMENT_LIFECYCLE_MEANING: Record<AgreementLifecycleState, string> = {
  NOT_CREATED: 'No agreement document or link exists yet.',
  DRAFTED: 'Agreement content prepared but link not issued.',
  GENERATED: 'Shareable agreement link exists; not yet sent.',
  SHARED: 'Operator intentionally shared or sent the agreement.',
  VIEWED: 'Participant opened the agreement.',
  SIGNED: 'Participant accepted the agreement terms.',
  APPROVED: 'Operator approved the signed agreement.',
};

export function deriveAgreementLifecycleState(
  participant: DemoParticipant
): AgreementLifecycleState {
  if (participant.agreementLifecycle) {
    return participant.agreementLifecycle;
  }
  if (participant.approvalStatus === 'Approved') return 'APPROVED';
  if (participant.agreementViewedAt || participant.inviteStatus === 'Opened') return 'VIEWED';
  if (participant.agreementSharedAt || participant.inviteSentAt) return 'SHARED';
  if (participant.agreementUrl) return 'GENERATED';
  return 'NOT_CREATED';
}

export function canTransitionAgreementLifecycle(
  from: AgreementLifecycleState,
  to: AgreementLifecycleState
): boolean {
  if (from === to) return true;
  return AGREEMENT_LIFECYCLE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function agreementLifecyclePrerequisites(state: AgreementLifecycleState): string[] {
  switch (state) {
    case 'GENERATED':
      return ['Agreement link created'];
    case 'SHARED':
      return ['Explicit operator share or send'];
    case 'VIEWED':
      return ['Participant opened agreement'];
    case 'APPROVED':
      return ['Operator approval recorded'];
    default:
      return [];
  }
}
