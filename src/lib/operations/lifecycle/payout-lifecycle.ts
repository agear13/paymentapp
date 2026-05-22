export const PAYOUT_ONBOARDING_PHASES = [
  'NOT_STARTED',
  'INVITED',
  'IN_PROGRESS',
  'COMPLETED',
] as const;

export type PayoutOnboardingPhase = (typeof PAYOUT_ONBOARDING_PHASES)[number];

export const PAYOUT_ONBOARDING_LABELS: Record<PayoutOnboardingPhase, string> = {
  NOT_STARTED: 'Payout onboarding not started',
  INVITED: 'Invited to complete payout onboarding',
  IN_PROGRESS: 'Payout onboarding in progress',
  COMPLETED: 'Payout onboarding complete',
};

export const PAYOUT_ONBOARDING_MEANING: Record<PayoutOnboardingPhase, string> = {
  NOT_STARTED: 'Payout details will be collected during participant onboarding.',
  INVITED: 'Participant invited to complete payout onboarding.',
  IN_PROGRESS: 'Participant is completing payout onboarding.',
  COMPLETED: 'Payout destination and onboarding are complete.',
};

/** Full banking/payout collection UI is not live yet — avoid false "missing destination" blockers. */
export const PAYOUT_ONBOARDING_UI_IMPLEMENTED = false;

export function derivePayoutOnboardingPhase(participant: {
  payoutOnboardingPhase?: PayoutOnboardingPhase;
  onboardingStatus?: string;
}): PayoutOnboardingPhase {
  if (participant.payoutOnboardingPhase) return participant.payoutOnboardingPhase;
  const s = participant.onboardingStatus;
  if (s === 'COMPLETE') return 'COMPLETED';
  if (s === 'INCOMPLETE') return 'IN_PROGRESS';
  return 'NOT_STARTED';
}

export function payoutOnboardingPlaceholderCopy(phase: PayoutOnboardingPhase): string {
  switch (phase) {
    case 'COMPLETED':
      return 'Payout onboarding complete';
    case 'IN_PROGRESS':
      return 'Participant payout onboarding in progress';
    case 'INVITED':
      return 'Invite participant to complete payout onboarding';
    default:
      return 'Participant payout onboarding has not started';
  }
}

export const PAYOUT_LIFECYCLE_STATES = [
  'NOT_APPLICABLE',
  'ONBOARDING_PENDING',
  'ONBOARDING_IN_PROGRESS',
  'READY',
  'BLOCKED',
] as const;

export type PayoutLifecycleState = (typeof PAYOUT_LIFECYCLE_STATES)[number];

export const PAYOUT_LIFECYCLE_LABELS: Record<PayoutLifecycleState, string> = {
  NOT_APPLICABLE: 'No payout configured',
  ONBOARDING_PENDING: 'Payout onboarding not started',
  ONBOARDING_IN_PROGRESS: 'Payout onboarding in progress',
  READY: 'Payout ready',
  BLOCKED: 'Payout blocked',
};
