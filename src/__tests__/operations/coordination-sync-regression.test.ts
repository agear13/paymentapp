import { deriveCurrencyConsistencyWarnings } from '@/lib/operations/derivations/derive-currency-consistency';
import { deriveParticipantReleaseEligibility } from '@/lib/operations/readiness/derive-participant-release-eligibility';
import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import type { RecentDeal } from '@/lib/data/mock-deal-network';

function baseDeal(): RecentDeal {
  return {
    id: 'deal-1',
    dealName: 'Test',
    partner: 'Test',
    value: 1000,
    introducer: '—',
    closer: '—',
    status: 'Pending',
    lastUpdated: new Date().toISOString(),
    paymentStatus: 'Not Paid',
    setupStatus: 'configuring',
  } as RecentDeal;
}

describe('currency consistency', () => {
  it('warns when service currencies differ from project currency', () => {
    const warnings = deriveCurrencyConsistencyWarnings({
      projectCurrency: 'AUD',
      serviceCurrencies: ['USD'],
      obligationCurrency: 'USD',
    });
    expect(warnings.some((w) => w.code === 'CURRENCY_INCONSISTENCY')).toBe(true);
  });
});

describe('release eligibility unification', () => {
  it('deriveParticipantReleaseEligibility matches payout release readiness', () => {
    const p = buildProjectParticipant({
      name: 'Ready',
      role: 'Contributor',
      project: baseDeal(),
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 100,
      enableCustomerAttribution: false,
    });
    p.compensationProfile = { ...p.compensationProfile!, configured: true };
    p.approvalStatus = 'Approved';
    p.payoutVerificationConfirmed = true;

    const eligibility = deriveParticipantReleaseEligibility(p, {
      projectId: 'deal-1',
      fundingAllocated: true,
    });
    expect(eligibility.releaseReady).toBe(true);
    expect(eligibility.payoutReady).toBe(true);
  });
});

describe('approval note hydration', () => {
  it('preserves approval note through hydration backfill', () => {
    const p = buildProjectParticipant({
      name: 'Coastal Media',
      role: 'Partner',
      project: baseDeal(),
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 500,
      enableCustomerAttribution: false,
    });
    p.approvalNote = 'Please confirm payout timing.';
    p.approvalStatus = 'Approved';

    const { hydrateOperationalParticipant } = require('@/lib/operations/hydration/hydrate-operational-participant');
    const hydrated = hydrateOperationalParticipant(p);
    expect(hydrated.approvalNote).toBe('Please confirm payout timing.');
  });
});
