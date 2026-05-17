export const ONBOARDING_USE_CASES = [
  {
    id: 'contractor_payouts',
    title: 'Contractor payouts',
    description: 'Coordinate contractor payments and release payouts when work is complete.',
  },
  {
    id: 'referral_commissions',
    title: 'Referral commissions',
    description: 'Track referrers, commissions, and participant payouts across deals.',
  },
  {
    id: 'revenue_sharing',
    title: 'Revenue sharing',
    description: 'Split revenue between partners with clear obligations and settlement.',
  },
  {
    id: 'affiliate_payouts',
    title: 'Affiliate payouts',
    description: 'Manage affiliates and pay out earned commissions safely.',
  },
  {
    id: 'event_settlement',
    title: 'Event / project settlement',
    description: 'Settle a defined project with multiple participants and funding milestones.',
  },
  {
    id: 'client_invoices',
    title: 'Client invoices',
    description: 'Collect client payments and coordinate downstream participant payouts.',
  },
] as const;

export type OnboardingUseCaseId = (typeof ONBOARDING_USE_CASES)[number]['id'];

export type OnboardingStep =
  | 'use_case'
  | 'project'
  | 'participants'
  | 'funding'
  | 'payment_rails'
  | 'complete';

export type OnboardingParticipantRole =
  | 'Contributor'
  | 'Contractor'
  | 'Referrer'
  | 'Partner';

export type OperatorOnboardingState = {
  step: OnboardingStep;
  onboarding_use_case?: OnboardingUseCaseId;
  onboarding_context?: string;
  organizationId?: string;
  merchantSettingsId?: string;
  projectId?: string;
  completed?: boolean;
  completedAt?: string;
};

export const ONBOARDING_STEP_ORDER: OnboardingStep[] = [
  'use_case',
  'project',
  'participants',
  'funding',
  'payment_rails',
];

export function onboardingStepIndex(step: OnboardingStep): number {
  if (step === 'complete') return ONBOARDING_STEP_ORDER.length;
  return ONBOARDING_STEP_ORDER.indexOf(step);
}

export function onboardingStepLabel(step: OnboardingStep): string {
  switch (step) {
    case 'use_case':
      return 'Define use case';
    case 'project':
      return 'Create project';
    case 'participants':
      return 'Add participants';
    case 'funding':
      return 'Funding flow';
    case 'payment_rails':
      return 'Payment methods';
    case 'complete':
      return 'Complete';
  }
}
