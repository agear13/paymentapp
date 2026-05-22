import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { OnboardingParticipantRole } from '@/lib/onboarding/operator-onboarding-types';
import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import type { ProjectParticipationModel } from '@/lib/projects/participant-entitlement';
import type { OperationalParticipantRole } from '@/lib/projects/participants-for-project';
import {
  draftParticipantDefaults,
  draftProjectDefaults,
} from '@/lib/operations/guards/hydration-guards';

export function buildOnboardingProject(input: {
  projectName: string;
  description?: string;
  estimatedValue?: number;
  currency: 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD' | 'JPY' | 'SGD' | 'NZD';
}): RecentDeal {
  const id = `onb-deal-${Date.now()}`;
  const now = new Date().toISOString();
  return {
    id,
    dealName: input.projectName.trim(),
    partner: input.projectName.trim(),
    value: input.estimatedValue ?? 0,
    introducer: '—',
    closer: '—',
    status: 'Pending',
    lastUpdated: now,
    paymentStatus: 'Not Paid',
    projectDescription: input.description?.trim() || undefined,
    projectValueCurrency: input.currency === 'AUD' || input.currency === 'USD' ? input.currency : 'USD',
    currentStage: 'Introduced',
    nextStep: 'Add participants and funding',
    ...draftProjectBootstrap(),
  };
}

const ROLE_TO_MODEL: Record<OnboardingParticipantRole, ProjectParticipationModel> = {
  Partner: 'revenue_share',
  'Co-founder': 'revenue_share',
  Stakeholder: 'fixed_payout',
  Contractor: 'fixed_payout',
  Supplier: 'fixed_payout',
  Promoter: 'revenue_share',
  Affiliate: 'revenue_share',
  Venue: 'customer_attribution',
  Staff: 'fixed_payout',
  Performer: 'fixed_payout',
  Referrer: 'revenue_share',
};

export function mapOnboardingRoleToOperational(
  role: OnboardingParticipantRole
): OperationalParticipantRole {
  switch (role) {
    case 'Partner':
    case 'Co-founder':
    case 'Promoter':
    case 'Venue':
      return 'Partner';
    case 'Stakeholder':
      return 'Contributor';
    case 'Contractor':
    case 'Staff':
    case 'Performer':
    case 'Supplier':
      return 'Contractor';
    case 'Affiliate':
    case 'Referrer':
      return 'Referrer';
  }
}

/** Canonical project participant — same model as project workspace invite. */
export function buildOnboardingParticipant(input: {
  name: string;
  email?: string;
  role: OnboardingParticipantRole;
  deal: RecentDeal;
}) {
  const participationModel = ROLE_TO_MODEL[input.role];
  const operationalRole = mapOnboardingRoleToOperational(input.role);
  return {
    ...buildProjectParticipant({
      name: input.name,
      email: input.email,
      role: operationalRole,
      project: input.deal,
      participationModel,
      commissionKind: participationModel === 'revenue_share' ? 'pct_deal_value' : 'fixed_amount',
      commissionValue: 0,
      enableCustomerAttribution: participationModel === 'customer_attribution',
      notes: `${input.role} · added during onboarding (draft — configure earnings)`,
    }),
    ...draftParticipantDefaults(),
  };
}
