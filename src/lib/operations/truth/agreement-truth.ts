import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { deriveAgreementLifecycleState } from '@/lib/operations/lifecycle/agreement-lifecycle';

export function isAgreementActuallyShared(participant: DemoParticipant): boolean {
  const state = deriveAgreementLifecycleState(participant);
  return (
    state === 'SHARED' ||
    state === 'VIEWED' ||
    state === 'SIGNED' ||
    state === 'APPROVED' ||
    Boolean(participant.agreementSharedAt || participant.inviteSentAt)
  );
}

export function isAgreementGenerated(participant: DemoParticipant): boolean {
  const state = deriveAgreementLifecycleState(participant);
  return state !== 'NOT_CREATED' && state !== 'DRAFTED';
}

export function agreementTruthLabel(participant: DemoParticipant): string {
  const state = deriveAgreementLifecycleState(participant);
  switch (state) {
    case 'NOT_CREATED':
      return 'Agreement not generated';
    case 'GENERATED':
      return 'Agreement link ready — not shared yet';
    case 'SHARED':
      return 'Agreement shared';
    case 'VIEWED':
      return 'Agreement opened';
    case 'APPROVED':
      return 'Agreement approved';
    default:
      return 'Agreement in progress';
  }
}
