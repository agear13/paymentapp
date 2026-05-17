import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { OnboardingParticipantRole } from '@/lib/onboarding/operator-onboarding-types';

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

const ROLE_MAP: Record<OnboardingParticipantRole, DemoParticipant['role']> = {
  Contributor: 'Contributor',
  Contractor: 'Contributor',
  Referrer: 'Introducer',
  Partner: 'Connector',
};

export function buildOnboardingParticipant(input: {
  name: string;
  email: string;
  role: OnboardingParticipantRole;
  dealId: string;
  dealName: string;
}): DemoParticipant {
  const id = `onb-p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const inviteToken = `onb-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return {
    id,
    name: input.name.trim(),
    email: input.email.trim(),
    role: ROLE_MAP[input.role],
    commissionKind: 'fixed_amount',
    commissionValue: 0,
    status: 'Pending',
    inviteStatus: 'Invited',
    approvalStatus: 'Pending approval',
    onboardingStatus: 'NOT_STARTED',
    inviteToken,
    dealId: input.dealId,
    dealName: input.dealName,
    roleDetails: `${input.role} — added during onboarding`,
  };
}
