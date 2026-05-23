export const PAYOUT_ONBOARDING_PHASES = [
  'NOT_STARTED',
  'INVITED',
  'IN_PROGRESS',
  'COMPLETED',
] as const;

export type PayoutOnboardingPhase = (typeof PAYOUT_ONBOARDING_PHASES)[number];

/** @deprecated Use operator payout confirmation labels */
export const PAYOUT_ONBOARDING_LABELS: Record<PayoutOnboardingPhase, string> = {
  NOT_STARTED: 'Operator payout confirmation pending',
  INVITED: 'Operator payout confirmation pending',
  IN_PROGRESS: 'Operator payout confirmation pending',
  COMPLETED: 'Confirmed by operator',
};

export const PAYOUT_ONBOARDING_MEANING: Record<PayoutOnboardingPhase, string> = {
  NOT_STARTED: 'Operator has not confirmed external payout details yet.',
  INVITED: 'Operator has not confirmed external payout details yet.',
  IN_PROGRESS: 'Operator has not confirmed external payout details yet.',
  COMPLETED: 'Operator confirmed payout details were collected externally.',
};

/** Regulated payout/KYC collection UI is not live — operators confirm externally. */
export const PAYOUT_ONBOARDING_UI_IMPLEMENTED = false;

export function derivePayoutOnboardingPhase(participant: {
  payoutVerificationConfirmed?: boolean;
  payoutOnboardingPhase?: PayoutOnboardingPhase;
  onboardingStatus?: string;
}): PayoutOnboardingPhase {
  if (participant.payoutVerificationConfirmed === true) return 'COMPLETED';
  if (participant.payoutOnboardingPhase) return participant.payoutOnboardingPhase;
  const s = participant.onboardingStatus;
  if (s === 'COMPLETE') return 'COMPLETED';
  if (s === 'INCOMPLETE') return 'IN_PROGRESS';
  return 'NOT_STARTED';
}

export function payoutOnboardingPlaceholderCopy(phase: PayoutOnboardingPhase): string {
  switch (phase) {
    case 'COMPLETED':
      return 'Payout details confirmed externally';
    default:
      return 'Operator payout confirmation pending';
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
  ONBOARDING_PENDING: 'Operator confirmation pending',
  ONBOARDING_IN_PROGRESS: 'Operator confirmation pending',
  READY: 'Payout ready',
  BLOCKED: 'Payout blocked',
};
