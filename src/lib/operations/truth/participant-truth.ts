import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  deriveParticipantLifecycleState,
  type ParticipantLifecycleState,
} from '@/lib/operations/lifecycle/participant-lifecycle';
import { participantLifecycleApprovalLabel } from '@/lib/operations/derivations/derive-approval-state';

export function isParticipantActuallyInvited(participant: DemoParticipant): boolean {
  const state = deriveParticipantLifecycleState(participant);
  return (
    state === 'INVITE_SENT' ||
    state === 'INVITE_VIEWED' ||
    state === 'PENDING_APPROVAL' ||
    Boolean(participant.inviteSentAt || participant.agreementSharedAt)
  );
}

export function isParticipantOperationallyApproved(participant: DemoParticipant): boolean {
  return (
    participant.approvalStatus === 'Approved' ||
    deriveParticipantLifecycleState(participant) === 'APPROVED' ||
    deriveParticipantLifecycleState(participant) === 'PAYOUT_READY' ||
    deriveParticipantLifecycleState(participant) === 'ACTIVE'
  );
}

export function participantLifecycleLabel(participant: DemoParticipant): string {
  const state = deriveParticipantLifecycleState(participant);
  if (state === 'PENDING_APPROVAL') {
    return participantLifecycleApprovalLabel(participant);
  }
  const labels: Record<ParticipantLifecycleState, string> = {
    DRAFT: 'Participant added',
    READY_TO_INVITE: 'Ready to invite',
    INVITE_GENERATED: 'Agreement not shared',
    INVITE_SENT: 'Agreement shared',
    INVITE_VIEWED: 'Agreement opened',
    PENDING_APPROVAL: participantLifecycleApprovalLabel(participant),
    APPROVED: 'Approved',
    ONBOARDING_REQUIRED: 'Waiting for operator payout confirmation',
    PAYOUT_READY: 'Payout ready',
    ACTIVE: 'Active',
  };
  return labels[state];
}

export function isDraftParticipant(participant: DemoParticipant): boolean {
  const state = deriveParticipantLifecycleState(participant);
  return state === 'DRAFT' || state === 'READY_TO_INVITE';
}
