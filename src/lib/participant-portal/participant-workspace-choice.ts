import type { ParticipantWorkspaceOnboarding } from '@/lib/participant-portal/participant-workspace-onboarding';

export type ParticipantWorkspaceChoice = {
  portalToken: string;
  path: string;
  projectName: string;
  operatorName: string;
  nextRequiredAction: string;
  statusLabel: string;
};

export function participantWorkspaceChoiceCopy(
  onboarding: ParticipantWorkspaceOnboarding
): { nextRequiredAction: string; statusLabel: string } {
  if (onboarding.step === 'agreement_review' || onboarding.step === 'awaiting_agreement_send') {
    return {
      statusLabel: 'Agreement pending',
      nextRequiredAction: onboarding.nextRequiredAction ?? 'Waiting for your agreement invitation',
    };
  }
  if (onboarding.step === 'payout_details') {
    return {
      statusLabel: 'Payout details required',
      nextRequiredAction: onboarding.nextRequiredAction ?? 'Add payout details',
    };
  }
  if (onboarding.step === 'payout_submitted') {
    return {
      statusLabel: 'Payout details submitted',
      nextRequiredAction: onboarding.nextRequiredAction ?? 'Waiting for payout verification',
    };
  }
  return {
    statusLabel: onboarding.onboardingComplete ? 'Active' : 'In progress',
    nextRequiredAction:
      onboarding.nextRequiredAction ?? 'Onboarding complete — you are now active',
  };
}
