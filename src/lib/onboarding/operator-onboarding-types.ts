import type { CollectionPreferenceId } from '@/lib/onboarding/collection-preference';

export const ONBOARDING_USE_CASES = [
  {
    id: 'event_settlement',
    title: 'Event Settlement',
    description: 'Settle a defined project with multiple participants and funding milestones.',
  },
  {
    id: 'revenue_sharing',
    title: 'Revenue Sharing',
    description: 'Split revenue between partners with clear obligations and settlement.',
  },
  {
    id: 'contractor_payouts',
    title: 'Contractor Payouts',
    description: 'Coordinate contractor obligations and release settlements when work is complete.',
  },
  {
    id: 'referral_commissions',
    title: 'Referral Programs',
    description: 'Track referrers, commissions, and participant obligations across deals.',
  },
  {
    id: 'affiliate_payouts',
    title: 'Affiliate Programs',
    description: 'Manage affiliates and coordinate earned commission settlements.',
  },
  {
    id: 'client_invoices',
    title: 'Client Invoice Coordination',
    description: 'Collect client revenue and coordinate downstream participant settlements.',
  },
] as const;

export type OnboardingUseCaseId = (typeof ONBOARDING_USE_CASES)[number]['id'];

export const ONBOARDING_START_METHODS = [
  {
    id: 'import',
    title: 'Import Existing Agreement',
    description:
      'Import a WhatsApp conversation, email thread, meeting notes, contract text, or other commercial discussion. Provvypay extracts participants, obligations, commercial terms and settlement requirements automatically.',
  },
  {
    id: 'create',
    title: 'Create New Agreement',
    description:
      'Define participants, obligations and settlement rules from scratch. Use this when you are creating a new commercial arrangement rather than importing an existing one.',
  },
  {
    id: 'template',
    title: 'Start From Template',
    description:
      'Launch a pre-configured workflow and customize it to your needs.',
  },
] as const;

export type OnboardingStartMethodId = (typeof ONBOARDING_START_METHODS)[number]['id'];

export const ONBOARDING_TEMPLATE_CATEGORIES = [
  'Revenue Sharing',
  'Affiliate Programs',
  'Referral Programs',
  'Event Settlement',
  'Contractor Payouts',
  'Client Invoice Coordination',
  'Marketplace Revenue Distribution',
  'Agency Commission Structures',
] as const;

export type OnboardingTemplateCategory = (typeof ONBOARDING_TEMPLATE_CATEGORIES)[number];

export const ONBOARDING_AGREEMENT_TEMPLATES = [
  {
    id: 'revenue_share',
    category: 'Revenue Sharing' as const,
    title: 'Revenue Share Agreement',
    useCaseId: 'revenue_sharing' as const,
    agreementName: 'Revenue Share Agreement',
    description: 'Split revenue between multiple participants with clear settlement rules.',
    participantSummary: 'Partner + Operator',
    settlementModel: 'Revenue share on net sales',
    typicalUseCase: 'Partnerships, joint ventures, and shared commercial outcomes',
    setupTimeMinutes: 2,
    participants: [
      { name: 'Revenue Partner', role: 'Partner' as const },
      { name: 'Operating Partner', role: 'Partner' as const },
    ],
    commercialTerms: ['15% Revenue Share', 'Net Sales Basis', 'Monthly Settlement', 'Settlement Within 10 Days'],
  },
  {
    id: 'affiliate_program',
    category: 'Affiliate Programs' as const,
    title: 'Affiliate Program',
    useCaseId: 'affiliate_payouts' as const,
    agreementName: 'Affiliate Program Agreement',
    description: 'Manage affiliate referrals and commission settlements.',
    participantSummary: 'Affiliate Partner',
    settlementModel: 'Commission on attributed sales',
    typicalUseCase: 'Digital products, SaaS referrals, and partner networks',
    setupTimeMinutes: 2,
    participants: [{ name: 'Affiliate Partner', role: 'Affiliate' as const }],
    commercialTerms: ['Affiliate Commission', '10% Revenue Share', 'Monthly Settlement'],
  },
  {
    id: 'referral_program',
    category: 'Referral Programs' as const,
    title: 'Referral Program',
    useCaseId: 'referral_commissions' as const,
    agreementName: 'Referral Program Agreement',
    description: 'Track referrers and commission obligations across introduced deals.',
    participantSummary: 'Referrer + Operator',
    settlementModel: 'Referral fee on closed deals',
    typicalUseCase: 'Introducer fees, broker arrangements, and deal sourcing',
    setupTimeMinutes: 2,
    participants: [
      { name: 'Referral Partner', role: 'Referrer' as const },
      { name: 'Program Operator', role: 'Partner' as const },
    ],
    commercialTerms: ['Referral Commission', '10% Revenue Share', 'Net Sales Basis', 'Monthly Settlement'],
  },
  {
    id: 'event_settlement',
    category: 'Event Settlement' as const,
    title: 'Event Settlement',
    useCaseId: 'event_settlement' as const,
    agreementName: 'Event Settlement Agreement',
    description: 'Coordinate promoters, venues, and performers for event revenue.',
    participantSummary: 'Promoter + Venue',
    settlementModel: 'Event revenue allocation',
    typicalUseCase: 'Festivals, ticketed events, and promoter partnerships',
    setupTimeMinutes: 3,
    participants: [
      { name: 'Event Promoter', role: 'Promoter' as const },
      { name: 'Venue Operator', role: 'Venue' as const },
    ],
    commercialTerms: ['Revenue Share', 'Bar Revenue Allocation', 'Settlement Within 10 Days'],
  },
  {
    id: 'contractor_payouts',
    category: 'Contractor Payouts' as const,
    title: 'Contractor Payouts',
    useCaseId: 'contractor_payouts' as const,
    agreementName: 'Contractor Services Agreement',
    description: 'Coordinate contractor deliverables and settlement timing.',
    participantSummary: 'Contractor',
    settlementModel: 'Fixed fee on completion',
    typicalUseCase: 'Freelancers, agencies, and deliverable-based work',
    setupTimeMinutes: 2,
    participants: [{ name: 'Contractor', role: 'Contractor' as const }],
    commercialTerms: ['Contractor Fee', 'Fixed Payout', 'Approval Required Before Release'],
  },
  {
    id: 'client_invoice',
    category: 'Client Invoice Coordination' as const,
    title: 'Client Invoice Coordination',
    useCaseId: 'client_invoices' as const,
    agreementName: 'Client Invoice Agreement',
    description: 'Collect client revenue and coordinate downstream settlements.',
    participantSummary: 'Client + Service Provider',
    settlementModel: 'Invoice collection and allocation',
    typicalUseCase: 'Client billing, agency invoicing, and downstream splits',
    setupTimeMinutes: 3,
    participants: [
      { name: 'Client', role: 'Partner' as const },
      { name: 'Service Provider', role: 'Contractor' as const },
    ],
    commercialTerms: ['Invoice Collection', 'Net 30 Settlement', 'Approval Required Before Release'],
  },
  {
    id: 'marketplace_revenue',
    category: 'Marketplace Revenue Distribution' as const,
    title: 'Marketplace Revenue Distribution',
    useCaseId: 'revenue_sharing' as const,
    agreementName: 'Marketplace Revenue Agreement',
    description: 'Distribute marketplace revenue across sellers, operators, and facilitators.',
    participantSummary: 'Seller + Marketplace Operator',
    settlementModel: 'Platform take rate and seller allocation',
    typicalUseCase: 'Marketplaces, platforms, and multi-seller coordination',
    setupTimeMinutes: 3,
    participants: [
      { name: 'Marketplace Operator', role: 'Partner' as const },
      { name: 'Seller Partner', role: 'Partner' as const },
    ],
    commercialTerms: ['15% Revenue Share', 'Net Sales Basis', 'Monthly Settlement'],
  },
  {
    id: 'agency_commission',
    category: 'Agency Commission Structures' as const,
    title: 'Agency Commission Structure',
    useCaseId: 'referral_commissions' as const,
    agreementName: 'Agency Commission Agreement',
    description: 'Structure agency commissions across campaigns and client revenue.',
    participantSummary: 'Agency + Client Partner',
    settlementModel: 'Commission on managed revenue',
    typicalUseCase: 'Agencies, campaign managers, and client revenue coordination',
    setupTimeMinutes: 3,
    participants: [
      { name: 'Agency Partner', role: 'Partner' as const },
      { name: 'Client Partner', role: 'Partner' as const },
    ],
    commercialTerms: ['Referral Commission', '15% Revenue Share', 'Monthly Settlement', 'Approval Required Before Release'],
  },
] as const;

export type OnboardingTemplateId = (typeof ONBOARDING_AGREEMENT_TEMPLATES)[number]['id'];

export const ONBOARDING_IMPORT_SOURCES = [
  'whatsapp',
  'email',
  'slack',
  'sms',
  'meeting_notes',
  'other',
] as const;

export type OnboardingStep =
  | 'workspace'
  | 'start_method'
  | 'import_source'
  | 'import_content'
  | 'template_select'
  | 'project'
  | 'participants'
  | 'agreement_review'
  | 'use_case'
  | 'funding'
  | 'payment_rails'
  | 'complete';

export type { CollectionPreferenceId } from '@/lib/onboarding/collection-preference';
export { COLLECTION_PREFERENCES } from '@/lib/onboarding/collection-preference';

export const ONBOARDING_PARTICIPANT_ROLES = [
  { value: 'Partner', label: 'Partner', description: 'Economic partner with negotiated allocation' },
  { value: 'Co-founder', label: 'Co-founder', description: 'Equity or profit-share relationship' },
  { value: 'Stakeholder', label: 'Stakeholder', description: 'Observer or beneficiary without direct settlement' },
  { value: 'Contractor', label: 'Contractor', description: 'Delivers contracted services and deliverables' },
  { value: 'Supplier', label: 'Supplier', description: 'Receives invoice-based settlements' },
  { value: 'Promoter', label: 'Promoter', description: 'Earns revenue share on event or campaign sales' },
  { value: 'Affiliate', label: 'Affiliate', description: 'Earns referral commissions' },
  { value: 'Venue', label: 'Venue', description: 'Host operator with revenue allocation' },
  { value: 'Staff', label: 'Staff', description: 'Internal team member with settlement obligations' },
  { value: 'Performer', label: 'Performer', description: 'Fixed-fee or revenue-linked performance settlement' },
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
  onboarding_start_method?: OnboardingStartMethodId;
  onboarding_context?: string;
  collection_preference?: CollectionPreferenceId;
  organizationId?: string;
  merchantSettingsId?: string;
  projectId?: string;
  completed?: boolean;
  completedAt?: string;
  /** Set when user selects Professional/Growth before Stripe checkout completes. */
  pending_billing_plan?: 'professional' | 'growth';
};

/** Visible progress steps — agreement creation sub-steps map to start_method. */
export const ONBOARDING_STEP_ORDER: OnboardingStep[] = [
  'workspace',
  'start_method',
  'agreement_review',
  'use_case',
  'funding',
  'payment_rails',
  'complete',
];

const AGREEMENT_BUILD_STEPS: OnboardingStep[] = [
  'import_source',
  'import_content',
  'template_select',
  'project',
  'participants',
];

export function resolveOnboardingProgressStep(step: OnboardingStep): OnboardingStep {
  if (AGREEMENT_BUILD_STEPS.includes(step)) return 'start_method';
  return step;
}

const LEGACY_STEP_MAP: Record<string, OnboardingStep> = {
  workspace: 'workspace',
  start_method: 'start_method',
  use_case: 'use_case',
  import_source: 'import_source',
  import_content: 'import_content',
  template_select: 'template_select',
  project: 'project',
  participants: 'participants',
  agreement_review: 'agreement_review',
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
  if (!step) return 'start_method';
  return LEGACY_STEP_MAP[step] ?? 'start_method';
}

export function onboardingStepIndex(step: OnboardingStep): number {
  const progressStep = resolveOnboardingProgressStep(step);
  if (progressStep === 'complete') return ONBOARDING_STEP_ORDER.length;
  return ONBOARDING_STEP_ORDER.indexOf(progressStep);
}

export function onboardingStepLabel(step: OnboardingStep): string {
  switch (resolveOnboardingProgressStep(step)) {
    case 'workspace':
      return 'Create workspace';
    case 'start_method':
      return 'Choose how to start';
    case 'agreement_review':
      return 'Agreement Intelligence';
    case 'use_case':
      return 'Choose workflow';
    case 'funding':
      return 'Revenue collection';
    case 'payment_rails':
      return 'Settlement infrastructure';
    case 'complete':
      return 'Agreement ready';
    default:
      return 'Choose how to start';
  }
}

export function onboardingStepTitle(step: OnboardingStep): string {
  switch (step) {
    case 'workspace':
      return 'Create your workspace';
    case 'start_method':
      return 'How would you like to create your first agreement?';
    case 'import_source':
      return 'Select agreement source';
    case 'import_content':
      return 'Import your commercial discussion';
    case 'template_select':
      return 'Choose a starting template';
    case 'project':
      return 'Define your agreement';
    case 'participants':
      return 'Who is involved in this agreement?';
    case 'agreement_review':
      return 'Agreement Intelligence Report';
    case 'use_case':
      return 'Choose your coordination workflow';
    case 'funding':
      return 'How will revenue be collected?';
    case 'payment_rails':
      return 'Configure settlement infrastructure';
    case 'complete':
      return 'Agreement Ready';
    default:
      return '';
  }
}

export function onboardingStepSubtext(step: OnboardingStep): string | null {
  switch (step) {
    case 'workspace':
      return 'This workspace coordinates agreements, obligations, approvals, and settlement across your commercial arrangements. You can create additional agreements later.';
    case 'start_method':
      return 'All three paths lead to Agreement Intelligence — choose the one that matches how your arrangement was formed.';
    case 'agreement_review':
      return 'Provvypay analyzed your agreement and identified the participants, commercial terms, obligations and settlement requirements.';
    case 'use_case':
      return 'Workflows determine how obligations and settlements are coordinated. You can add more workflows later.';
    case 'funding':
      return 'Define how revenue enters this agreement. All collection methods feed into the same settlement workspace.';
    case 'payment_rails':
      return 'Define how settlements will ultimately be coordinated. You can configure these anytime in Settings.';
    case 'complete':
      return 'Your commercial agreement has been analyzed and configured for coordination.';
    default:
      return null;
  }
}

export const ONBOARDING_PRICING_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$0',
    tagline: 'Perfect for exploring Agreement Intelligence.',
    recommended: false,
    features: [
      'Up to 3 Agreements',
      'Up to 3 AI Imports',
      'Single Workspace',
      'Manual Settlement Tracking',
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: '$49/month',
    tagline: 'Recommended for active operators.',
    recommended: true,
    features: [
      'Unlimited Agreements',
      'Unlimited AI Imports',
      'Payment Links',
      'Referral Management',
      'Xero Integration',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$149/month',
    tagline: 'For agencies and multi-party operations.',
    recommended: false,
    features: [
      'Everything in Professional',
      'Multi-user Team Access',
      'Approval Workflows',
      'Advanced Reporting',
      'Automated Settlement Coordination',
      'Priority Support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Contact Sales',
    tagline: 'For custom coordination workflows.',
    recommended: false,
    features: [
      'Multi-Organisation',
      'API Access',
      'Custom Workflows',
      'Custom Settlement Rules',
      'Dedicated Onboarding',
    ],
  },
] as const;
