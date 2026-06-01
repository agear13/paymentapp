import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  mapSinglePartyToParticipant,
  mergeExtractedCompensationIntoExistingParticipant,
} from '@/lib/ai-extractor/extraction-mapper';
import type { ReviewedParty } from '@/lib/ai-extractor/review-form-types';
import { isParticipantEarningsConfigured } from '@/lib/operations/selectors/participant-earnings-selectors';
import { deriveCommissionScope } from '@/lib/operations/derivations/commission-scope';
import { hydrateOperationalParticipant } from '@/lib/operations/hydration/hydrate-operational-participant';
import {
  needsScalarRevenueShareProfileRepair,
  repairScalarCompensationProfile,
} from '@/lib/participants/repair-scalar-compensation-profile';

function baseDeal(): RecentDeal {
  return {
    id: 'deal-1',
    dealName: 'Test Project',
    partner: 'Merchant',
    value: 10000,
    introducer: '',
    closer: '',
    status: 'Pending',
    lastUpdated: new Date().toISOString(),
    paymentStatus: 'Not Paid',
  };
}

function revenueShareParty(overrides: Partial<ReviewedParty> = {}): ReviewedParty {
  return {
    id: 'party-1',
    name: 'Damn Good Times Ltd',
    email: '',
    role: 'Partner',
    participationModel: 'revenue_share',
    fixedAmount: null,
    revenueSharePct: 10,
    notes: '',
    ...overrides,
  };
}

function existingParticipant(overrides: Partial<DemoParticipant> = {}): DemoParticipant {
  return {
    id: 'proj-p-existing',
    name: 'Damn Good Times Ltd',
    email: '',
    role: 'Contributor',
    commissionKind: 'fixed_amount',
    commissionValue: 0,
    status: 'Pending',
    approvalStatus: 'Pending approval',
    inviteToken: 'existing-token',
    dealId: 'deal-1',
    agreementLifecycle: 'NOT_CREATED',
    participantLifecycle: 'DRAFT',
    agreementUrl: undefined,
    ...overrides,
  };
}

describe('AI extraction compensation persistence', () => {
  it('mergeExtractedCompensationIntoExistingParticipant preserves lifecycle and applies profile', () => {
    const existing = existingParticipant({
      approvalStatus: 'Approved',
      agreementLifecycle: 'APPROVED',
      agreementUrl: '/deal-invites/existing-token',
    });
    const built = mapSinglePartyToParticipant(revenueShareParty(), baseDeal(), '[AI Import]');

    const merged = mergeExtractedCompensationIntoExistingParticipant(existing, built);

    expect(merged.id).toBe('proj-p-existing');
    expect(merged.inviteToken).toBe('existing-token');
    expect(merged.approvalStatus).toBe('Approved');
    expect(merged.agreementUrl).toBe('/deal-invites/existing-token');
    expect(merged.compensationProfile?.compensationType).toBe('REVENUE_SHARE');
    expect(merged.compensationProfile?.percentage).toBe(10);
    expect(merged.compensationProfile?.configured).toBe(true);
    expect(merged.commissionValue).toBe(10);
    expect(isParticipantEarningsConfigured(merged)).toBe(true);
    expect(deriveCommissionScope(merged).earningsPrimary).toBe('10% revenue share');
  });

  it('repairScalarCompensationProfile backfills legacy AI-import rows', () => {
    const legacy = existingParticipant({
      participationModel: 'revenue_share',
      commissionKind: 'pct_deal_value',
      commissionValue: 10,
    });
    expect(needsScalarRevenueShareProfileRepair(legacy)).toBe(true);

    const { participant: repaired, repaired: wasRepaired } = repairScalarCompensationProfile(legacy);
    expect(wasRepaired).toBe(true);
    expect(repaired.compensationProfile?.compensationType).toBe('REVENUE_SHARE');
    expect(repaired.compensationProfile?.configured).toBe(true);

    const hydrated = hydrateOperationalParticipant(repaired);
    expect(isParticipantEarningsConfigured(hydrated)).toBe(true);
    expect(deriveCommissionScope(hydrated).settlementBasis).toBe('project_settlement_allocation');
  });

  it('does not repair participants that already have persisted compensation terms', () => {
    const configured = existingParticipant({
      commissionValue: 10,
      participationModel: 'revenue_share',
      compensationProfile: {
        compensationType: 'REVENUE_SHARE',
        percentage: 10,
        configured: true,
        configuredAt: '2026-01-01T00:00:00.000Z',
        revenueSources: [],
      },
    });
    expect(needsScalarRevenueShareProfileRepair(configured)).toBe(false);
    expect(repairScalarCompensationProfile(configured).repaired).toBe(false);
  });
});
