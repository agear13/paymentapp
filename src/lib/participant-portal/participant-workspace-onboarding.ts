/**
 * Participant Workspace — commercial onboarding flow.
 *
 * Single URL, staged experience:
 *   1. Agreement review & approval
 *   2. Payout details (embedded in workspace)
 *   3. Commercial workspace
 */
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { supplierLifecycle, isPaymentRequestSent } from '@/lib/commercial/participant-lifecycle-primitives';
import {
  hasApprovedAgreement,
  isParticipantCompensationExempt,
} from '@/lib/operations/primitives/participant-earnings-primitives';

export const PARTICIPANT_WORKSPACE_ONBOARDING_STEPS = [
  'awaiting_agreement_send',
  'agreement_review',
  'payout_details',
  'payout_submitted',
  'complete',
] as const;

export type ParticipantWorkspaceOnboardingStep =
  (typeof PARTICIPANT_WORKSPACE_ONBOARDING_STEPS)[number];

export type AgreementOrganiserStatus = 'Pending' | 'Approved';
export type PayoutDetailsOrganiserStatus = 'Pending' | 'Submitted' | 'Verified' | 'Not required';

export type ParticipantWorkspaceOnboarding = {
  step: ParticipantWorkspaceOnboardingStep;
  agreementStatus: AgreementOrganiserStatus;
  payoutDetailsStatus: PayoutDetailsOrganiserStatus;
  nextRequiredAction: string | null;
  onboardingComplete: boolean;
};

function isAgreementShared(participant: DemoParticipant): boolean {
  return Boolean(
    participant.agreementSharedAt ||
      participant.inviteSentAt ||
      participant.agreementViewedAt
  );
}

export function derivePayoutDetailsOrganiserStatus(
  participant: DemoParticipant
): PayoutDetailsOrganiserStatus {
  if (isParticipantCompensationExempt(participant)) return 'Not required';
  if (!hasApprovedAgreement(participant)) return 'Pending';

  const lifecycle = supplierLifecycle(participant);
  if (lifecycle === 'APPROVED' || participant.payoutVerificationConfirmed) {
    return 'Verified';
  }
  if (lifecycle === 'SUBMITTED' || lifecycle === 'UNDER_REVIEW') {
    return 'Submitted';
  }
  return 'Pending';
}

export function deriveAgreementOrganiserStatus(
  participant: DemoParticipant
): AgreementOrganiserStatus {
  return hasApprovedAgreement(participant) ? 'Approved' : 'Pending';
}

export function participantNeedsPayoutDetailsStep(participant: DemoParticipant): boolean {
  if (!hasApprovedAgreement(participant)) return false;
  if (isParticipantCompensationExempt(participant)) return false;

  const lifecycle = supplierLifecycle(participant);
  return (
    lifecycle === 'NOT_STARTED' ||
    lifecycle === 'INVITED' ||
    lifecycle === 'IN_PROGRESS' ||
    lifecycle === 'REJECTED'
  );
}

export function deriveParticipantWorkspaceOnboarding(
  participant: DemoParticipant,
  options?: { urlStep?: string | null; previewMode?: boolean }
): ParticipantWorkspaceOnboarding {
  const agreementStatus = deriveAgreementOrganiserStatus(participant);
  const payoutDetailsStatus = derivePayoutDetailsOrganiserStatus(participant);

  if (options?.previewMode && !hasApprovedAgreement(participant)) {
    return {
      step: 'agreement_review',
      agreementStatus,
      payoutDetailsStatus,
      nextRequiredAction: 'Review and approve your commercial agreement.',
      onboardingComplete: false,
    };
  }

  if (!hasApprovedAgreement(participant)) {
    if (isAgreementShared(participant)) {
      return {
        step: 'agreement_review',
        agreementStatus,
        payoutDetailsStatus,
        nextRequiredAction: 'Review and approve your commercial agreement.',
        onboardingComplete: false,
      };
    }
    return {
      step: 'awaiting_agreement_send',
      agreementStatus,
      payoutDetailsStatus,
      nextRequiredAction: null,
      onboardingComplete: false,
    };
  }

  if (payoutDetailsStatus === 'Not required' || payoutDetailsStatus === 'Verified') {
    return {
      step: 'complete',
      agreementStatus,
      payoutDetailsStatus,
      nextRequiredAction: null,
      onboardingComplete: true,
    };
  }

  if (payoutDetailsStatus === 'Submitted') {
    return {
      step: 'payout_submitted',
      agreementStatus,
      payoutDetailsStatus,
      nextRequiredAction: null,
      onboardingComplete: true,
    };
  }

  const forcePayout = options?.urlStep === 'payout';
  if (forcePayout || participantNeedsPayoutDetailsStep(participant) || isPaymentRequestSent(participant)) {
    return {
      step: 'payout_details',
      agreementStatus,
      payoutDetailsStatus,
      nextRequiredAction: 'Complete your payout and tax details.',
      onboardingComplete: false,
    };
  }

  return {
    step: 'complete',
    agreementStatus,
    payoutDetailsStatus,
    nextRequiredAction: null,
    onboardingComplete: true,
  };
}
