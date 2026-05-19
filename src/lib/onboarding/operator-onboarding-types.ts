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
    description: 'Manage affiliates and pay out earned commissions.',
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

export const ONBOARDING_PARTICIPANT_ROLES = [
  { value: 'Contractor', label: 'Contractor', description: 'Delivers contracted services and deliverables' },
  { value: 'Supplier', label: 'Supplier', description: 'Receives invoice-based payouts' },
  { value: 'Promoter', label: 'Promoter', description: 'Earns revenue share on event or campaign sales' },
  { value: 'Affiliate', label: 'Affiliate', description: 'Earns referral commissions' },
  { value: 'Venue', label: 'Venue', description: 'Host operator with revenue allocation' },
  { value: 'Staff', label: 'Staff', description: 'Internal team member with payout obligations' },
  { value: 'Performer', label: 'Performer', description: 'Fixed-fee or revenue-linked performance payout' },
  { value: 'Referrer', label: 'Referrer', description: 'Introduces deals and earns referral fees' },
] as const;

export type OnboardingParticipantRole = (typeof ONBOARDING_PARTICIPANT_ROLES)[number]['value'];

export const ONBOARDING_PARTICIPANT_ROLE_VALUES = ONBOARDING_PARTICIPANT_ROLES.map(
  (r) => r.value
) as [OnboardingParticipantRole, ...OnboardingParticipantRole[]];

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
      return 'How you get paid';
    case 'payment_rails':
      return 'Payment methods';
    case 'complete':
      return 'Complete';
  }
}

export function onboardingStepTitle(step: OnboardingStep): string {
  switch (step) {
    case 'use_case':
      return 'What are you coordinating?';
    case 'project':
      return 'Create your first project';
    case 'participants':
      return 'Who needs to get paid?';
    case 'funding':
      return 'How will revenue be collected?';
    case 'payment_rails':
      return 'Connect payment methods';
    default:
      return '';
  }
}
