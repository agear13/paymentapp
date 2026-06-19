import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { deriveAgreementLifecycleState } from '@/lib/operations/lifecycle/agreement-lifecycle';
import { deriveParticipantReleaseEligibility } from '@/lib/operations/readiness/derive-participant-release-eligibility';

/** Explicit agreement coordination lifecycle — no implicit transitions. */
export const CANONICAL_AGREEMENT_STATES = [
  'DRAFT',
  'SHARED_FOR_APPROVAL',
  'VIEWED_BY_PARTICIPANT',
  'APPROVED_BY_PARTICIPANT',
  'OPERATOR_CONFIRMED',
  'READY_FOR_PAYOUT',
] as const;

export type CanonicalAgreementState = (typeof CANONICAL_AGREEMENT_STATES)[number];

export const CANONICAL_AGREEMENT_LABELS: Record<CanonicalAgreementState, string> = {
  DRAFT: 'Agreement draft',
  SHARED_FOR_APPROVAL: 'Shared for participant approval',
  VIEWED_BY_PARTICIPANT: 'Viewed by participant',
  APPROVED_BY_PARTICIPANT: 'Approved by participant',
  OPERATOR_CONFIRMED: 'Supplier onboarding complete',
  READY_FOR_PAYOUT: 'Ready for payout',
};

export const CANONICAL_AGREEMENT_TRANSITIONS: Record<
  CanonicalAgreementState,
  readonly CanonicalAgreementState[]
> = {
  DRAFT: ['SHARED_FOR_APPROVAL'],
  SHARED_FOR_APPROVAL: ['VIEWED_BY_PARTICIPANT', 'DRAFT'],
  VIEWED_BY_PARTICIPANT: ['APPROVED_BY_PARTICIPANT', 'SHARED_FOR_APPROVAL'],
  APPROVED_BY_PARTICIPANT: ['OPERATOR_CONFIRMED'],
  OPERATOR_CONFIRMED: ['READY_FOR_PAYOUT', 'APPROVED_BY_PARTICIPANT'],
  READY_FOR_PAYOUT: ['OPERATOR_CONFIRMED'],
};

export function deriveCanonicalAgreementState(
  participant: DemoParticipant,
  context?: { fundingAllocated?: boolean; obligationCount?: number }
): CanonicalAgreementState {
  const legacy = deriveAgreementLifecycleState(participant);
  const release = deriveParticipantReleaseEligibility(participant, {
    fundingAllocated: context?.fundingAllocated,
  });

  if (release.releaseReady && (context?.obligationCount ?? 0) > 0 && context?.fundingAllocated) {
    return 'READY_FOR_PAYOUT';
  }
  if (participant.payoutVerificationConfirmed === true && participant.approvalStatus === 'Approved') {
    return 'OPERATOR_CONFIRMED';
  }
  if (participant.approvalStatus === 'Approved') {
    return 'APPROVED_BY_PARTICIPANT';
  }
  if (legacy === 'VIEWED' || participant.agreementViewedAt || participant.inviteStatus === 'Opened') {
    return 'VIEWED_BY_PARTICIPANT';
  }
  if (
    legacy === 'SHARED' ||
    participant.agreementSharedAt ||
    participant.inviteSentAt
  ) {
    return 'SHARED_FOR_APPROVAL';
  }
  return 'DRAFT';
}

export function canTransitionCanonicalAgreement(
  from: CanonicalAgreementState,
  to: CanonicalAgreementState
): boolean {
  if (from === to) return true;
  return CANONICAL_AGREEMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Only shared-for-approval (or viewed) links can be approved — copy/preview never mutate lifecycle. */
export function canParticipantApproveAgreement(participant: DemoParticipant): boolean {
  const state = deriveCanonicalAgreementState(participant);
  return state === 'SHARED_FOR_APPROVAL' || state === 'VIEWED_BY_PARTICIPANT';
}

export function agreementActionMutatesLifecycle(action: 'share' | 'view' | 'copy' | 'approve'): boolean {
  return action === 'share' || action === 'approve';
}
