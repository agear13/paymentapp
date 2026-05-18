import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { OnboardingParticipantRole } from '@/lib/onboarding/operator-onboarding-types';
import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import type { ProjectParticipationModel } from '@/lib/projects/participant-entitlement';

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
  };
}

const ROLE_TO_MODEL: Record<OnboardingParticipantRole, ProjectParticipationModel> = {
  Contributor: 'fixed_payout',
  Contractor: 'fixed_payout',
  Referrer: 'revenue_share',
  Partner: 'customer_attribution',
};

/** Canonical project participant — same model as project workspace invite. */
export function buildOnboardingParticipant(input: {
  name: string;
  email?: string;
  role: OnboardingParticipantRole;
  deal: RecentDeal;
}) {
  const participationModel = ROLE_TO_MODEL[input.role];
  return buildProjectParticipant({
    name: input.name,
    email: input.email,
    role: input.role,
    project: input.deal,
    participationModel,
    commissionKind: participationModel === 'revenue_share' ? 'pct_deal_value' : 'fixed_amount',
    commissionValue: participationModel === 'revenue_share' ? 10 : 0,
    enableCustomerAttribution: participationModel === 'customer_attribution',
    notes: `${input.role} — added during onboarding`,
  });
}
