import { describe, expect, it } from '@jest/globals';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  hasImportedCompensationProfile,
  mapDemoParticipantToOnboardingDraft,
  participantFromOnboardingDraft,
} from '@/lib/onboarding/onboarding-participant-persist';

const deal: RecentDeal = {
  id: 'deal-onb-1',
  dealName: 'Test Event',
  partner: 'Test',
  value: 10000,
  introducer: '',
  closer: '',
  status: 'Pending',
  lastUpdated: new Date().toISOString(),
  paymentStatus: 'Not Paid',
};

function islandImported(): DemoParticipant {
  return {
    id: 'import-1',
    dealId: deal.id,
    name: 'Island DJs',
    email: '',
    role: 'Contributor',
    participationModel: 'fixed_payout',
    commissionKind: 'fixed_amount',
    commissionValue: 2500,
    inviteToken: 'tok-1',
    status: 'Pending',
    approvalStatus: 'Pending approval',
    compensationProfile: {
      compensationType: 'FIXED_FEE',
      fixedAmount: 2500,
      configured: true,
      configuredAt: '2026-01-01T00:00:00.000Z',
    },
  } as DemoParticipant;
}

describe('onboarding-participant-persist', () => {
  it('mapDemoParticipantToOnboardingDraft preserves compensation fields', () => {
    const draft = mapDemoParticipantToOnboardingDraft(islandImported());
    expect(draft.participationModel).toBe('fixed_payout');
    expect(draft.commissionValue).toBe(2500);
    expect(draft.compensationProfile?.fixedAmount).toBe(2500);
    expect(draft.role).toBe('Performer');
    expect(hasImportedCompensationProfile(draft)).toBe(true);
  });

  it('participantFromOnboardingDraft keeps FIXED_FEE 2500 for imported rows', () => {
    const draft = mapDemoParticipantToOnboardingDraft(islandImported());
    const persisted = participantFromOnboardingDraft(draft, deal);
    expect(persisted.compensationProfile?.compensationType).toBe('FIXED_FEE');
    expect(persisted.compensationProfile?.fixedAmount).toBe(2500);
    expect(persisted.commissionValue).toBe(2500);
  });

  it('participantFromOnboardingDraft uses default builder for manual rows', () => {
    const manual = {
      name: 'Manual Contractor',
      email: '',
      role: 'Contractor' as const,
    };
    const persisted = participantFromOnboardingDraft(manual, deal);
    expect(persisted.compensationProfile?.configured).not.toBe(true);
    expect(persisted.commissionValue).toBe(0);
  });

  it('coastal revenue share maps to Promoter and preserves REVENUE_SHARE', () => {
    const coastal = {
      ...islandImported(),
      name: 'Coastal Promotions',
      participationModel: 'revenue_share' as const,
      commissionValue: 15,
      compensationProfile: {
        compensationType: 'REVENUE_SHARE' as const,
        percentage: 15,
        configured: true,
        configuredAt: '2026-01-01T00:00:00.000Z',
      },
    };
    const draft = mapDemoParticipantToOnboardingDraft(coastal);
    expect(draft.role).toBe('Promoter');
    const persisted = participantFromOnboardingDraft(draft, deal);
    expect(persisted.compensationProfile?.compensationType).toBe('REVENUE_SHARE');
    expect(persisted.compensationProfile?.percentage).toBe(15);
  });
});
