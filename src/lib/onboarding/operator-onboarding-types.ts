import type { CollectionPreferenceId } from '@/lib/onboarding/collection-preference';

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
  | 'workspace'
  | 'use_case'
  | 'project'
  | 'participants'
  | 'funding'
  | 'payment_rails'
  | 'complete';

export type { CollectionPreferenceId } from '@/lib/onboarding/collection-preference';
export { COLLECTION_PREFERENCES } from '@/lib/onboarding/collection-preference';

export const ONBOARDING_PARTICIPANT_ROLES = [
  { value: 'Partner', label: 'Partner', description: 'Economic partner with negotiated allocation' },
  { value: 'Co-founder', label: 'Co-founder', description: 'Equity or profit-share relationship' },
  { value: 'Stakeholder', label: 'Stakeholder', description: 'Observer or beneficiary without direct payout' },
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
  workspace_name?: string;
  workspace_industry?: string;
  workspace_team_size?: string;
  onboarding_use_case?: OnboardingUseCaseId;
  onboarding_context?: string;
  collection_preference?: CollectionPreferenceId;
  organizationId?: string;
  merchantSettingsId?: string;
  projectId?: string;
  completed?: boolean;
  completedAt?: string;
};

export const ONBOARDING_STEP_ORDER: OnboardingStep[] = [
  'workspace',
  'use_case',
  'project',
  'participants',
  'funding',
  'payment_rails',
];

const LEGACY_STEP_MAP: Record<string, OnboardingStep> = {
  use_case: 'use_case',
  project: 'project',
  participants: 'participants',
  funding: 'funding',
  payment_rails: 'payment_rails',
  complete: 'complete',
};

/** Normalize persisted steps for users mid-migration */
export function normalizeOnboardingStep(
  step: string | undefined,
  hasOrganization: boolean
): OnboardingStep {
  if (!hasOrganization) return 'workspace';
  if (!step) return 'use_case';
  return LEGACY_STEP_MAP[step] ?? 'use_case';
}

export function onboardingStepIndex(step: OnboardingStep): number {
  if (step === 'complete') return ONBOARDING_STEP_ORDER.length;
  return ONBOARDING_STEP_ORDER.indexOf(step);
}

export function onboardingStepLabel(step: OnboardingStep): string {
  switch (step) {
    case 'workspace':
      return 'Create workspace';
    case 'use_case':
      return 'Choose workflow';
    case 'project':
      return 'Create project';
    case 'participants':
      return 'Add participants';
    case 'funding':
      return 'Collection method';
    case 'payment_rails':
      return 'Payment providers';
    case 'complete':
      return 'Complete';
  }
}

export function onboardingStepTitle(step: OnboardingStep): string {
  switch (step) {
    case 'workspace':
      return 'Create your workspace';
    case 'use_case':
      return 'What are you coordinating?';
    case 'project':
      return 'Create your first project';
    case 'participants':
      return 'Who needs to get paid?';
    case 'funding':
      return 'How do you usually collect money?';
    case 'payment_rails':
      return 'Connect payment providers';
    default:
      return '';
  }
}

export function onboardingStepSubtext(step: OnboardingStep): string | null {
  switch (step) {
    case 'workspace':
      return 'This workspace coordinates revenue, obligations, approvals, and payouts across your projects. You can create additional projects later.';
    case 'funding':
      return 'All collection methods feed into the same project payout workspace.';
    case 'payment_rails':
      return 'Connect providers when you are ready to collect and release payouts. You can configure these anytime in Settings.';
    default:
      return null;
  }
}
