export const PAYOUT_ONBOARDING_PHASES = [
  'NOT_STARTED',
  'INVITED',
  'IN_PROGRESS',
  'COMPLETED',
] as const;

export type PayoutOnboardingPhase = (typeof PAYOUT_ONBOARDING_PHASES)[number];

/** Labels shown in participant rows and status badges for each onboarding phase. */
export const PAYOUT_ONBOARDING_LABELS: Record<PayoutOnboardingPhase, string> = {
  NOT_STARTED: 'Supplier onboarding not started',
  INVITED: 'Supplier onboarding link sent',
  IN_PROGRESS: 'Supplier onboarding in progress',
  COMPLETED: 'Supplier onboarding complete',
};

export const PAYOUT_ONBOARDING_MEANING: Record<PayoutOnboardingPhase, string> = {
  NOT_STARTED: 'Supplier onboarding has not been started yet.',
  INVITED: 'Supplier onboarding link has been sent — awaiting supplier submission.',
  IN_PROGRESS: 'Supplier is completing onboarding.',
  COMPLETED: 'Supplier onboarding complete — bank details, ABN, and GST confirmed.',
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
      return 'Supplier onboarding complete';
    case 'IN_PROGRESS':
      return 'Supplier onboarding in progress';
    case 'INVITED':
      return 'Supplier onboarding link sent — awaiting submission';
    default:
      return 'Supplier onboarding required';
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
  ONBOARDING_PENDING: 'Supplier onboarding required',
  ONBOARDING_IN_PROGRESS: 'Supplier onboarding in progress',
  READY: 'Payout ready',
  BLOCKED: 'Payout blocked',
};
