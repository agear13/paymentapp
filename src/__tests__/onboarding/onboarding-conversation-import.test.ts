import { describe, expect, it } from '@jest/globals';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { ExtractionResult, ExtractedParty } from '@/lib/ai-extractor/extraction-types';
import { hydrateParticipant } from '@/lib/operations/hydration/hydrate-participant';
import { deriveCompensationState } from '@/lib/operations/derivations/derive-compensation-state';
import { hasPersistedCompensationTerms } from '@/lib/operations/primitives/participant-earnings-primitives';
import {
  onboardingDraftsFromExtraction,
  participantsFromOnboardingDrafts,
} from '@/lib/onboarding/onboarding-participant-persist';
import { resolveParticipantCommissionUsd } from '@/lib/deal-network-demo/commission-structure';

function field<T>(value: T, confidence: 'high' | 'medium' | 'low' | 'absent' = 'high') {
  return { value, confidence };
}

/** Sample conversation from production validation (Venue / DJ / Coastal / Affiliate). */
function venueTermsExtractionResult(): ExtractionResult {
  const parties: ExtractedParty[] = [
    {
      id: 'ep-1',
      name: field('DJ Alex'),
      email: field(null, 'absent'),
      role: field('Contractor'),
      participationModel: field('fixed_payout'),
      fixedAmount: field(2000),
      revenueSharePct: field(null, 'absent'),
      notes: field('Performance fee AUD 2,000'),
    },
    {
      id: 'ep-2',
      name: field('Coastal Promotions'),
      email: field(null, 'absent'),
      role: field('Partner'),
      participationModel: field('revenue_share'),
      fixedAmount: field(null, 'absent'),
      revenueSharePct: field(12),
      notes: field('12% of ticket revenue'),
    },
    {
      id: 'ep-3',
      name: field('Affiliate Network Bali'),
      email: field(null, 'absent'),
      role: field('Referrer'),
      participationModel: field('customer_attribution'),
      fixedAmount: field(null, 'absent'),
      revenueSharePct: field(15),
      notes: field('15% of referred bookings'),
    },
  ];

  return {
    projectName: field('Venue Event Agreement'),
    projectDescription: field("Let's confirm everyone's terms."),
    projectValue: field(null, 'absent'),
    currency: field('AUD'),
    counterparty: field('Venue'),
    parties,
    paymentTerms: [],
    uncertainties: [],
    overallConfidence: 'high',
    sourceHint: 'whatsapp',
    extractedAt: '2026-06-07T12:00:00.000Z',
  };
}

function sampleDeal(): RecentDeal {
  return {
    id: 'onb-deal-sample',
    dealName: 'Venue Event Agreement',
    partner: 'Venue',
    value: 0,
    introducer: '',
    closer: '',
    status: 'Pending',
    lastUpdated: '2026-06-07T12:00:00.000Z',
    paymentStatus: 'Not Paid',
    projectValueCurrency: 'AUD',
  };
}

/** Mirrors POST /api/onboarding/participants append semantics. */
function appendOnboardingParticipants(
  existing: ReturnType<typeof participantsFromOnboardingDrafts>,
  drafts: ReturnType<typeof onboardingDraftsFromExtraction>,
  deal: RecentDeal
) {
  const newParticipants = participantsFromOnboardingDrafts(drafts, deal);
  return [...existing, ...newParticipants];
}

describe('onboarding conversation import remediation', () => {
  const deal = sampleDeal();
  const extraction = venueTermsExtractionResult();

  it('maps three parties with compensation via workspace import path', () => {
    const drafts = onboardingDraftsFromExtraction(extraction, deal, 'whatsapp', 'AUD');
    expect(drafts).toHaveLength(3);
    expect(drafts.map((d) => d.name)).toEqual([
      'DJ Alex',
      'Coastal Promotions',
      'Affiliate Network Bali',
    ]);
    expect(drafts[0]?.compensationProfile?.compensationType).toBe('FIXED_FEE');
    expect(drafts[0]?.compensationProfile?.fixedAmount).toBe(2000);
    expect(drafts[1]?.compensationProfile?.compensationType).toBe('REVENUE_SHARE');
    expect(drafts[1]?.compensationProfile?.percentage).toBe(12);
    expect(drafts[2]?.compensationProfile?.compensationType).toBe('COMMISSION');
    expect(drafts[2]?.compensationProfile?.percentage).toBe(15);
    expect(drafts[2]?.compensationProfile?.customerAttributionEnabled).toBe(true);
  });

  it('persists fixed payout AUD 2000 for DJ Alex', () => {
    const drafts = onboardingDraftsFromExtraction(extraction, deal, 'whatsapp', 'AUD');
    const persisted = participantsFromOnboardingDrafts([drafts[0]!], deal)[0]!;
    expect(persisted.compensationProfile?.compensationType).toBe('FIXED_FEE');
    expect(persisted.compensationProfile?.fixedAmount).toBe(2000);
    expect(persisted.commissionValue).toBe(2000);
    expect(hasPersistedCompensationTerms(persisted)).toBe(true);
  });

  it('persists revenue share 12% for Coastal Promotions', () => {
    const drafts = onboardingDraftsFromExtraction(extraction, deal, 'whatsapp', 'AUD');
    const persisted = participantsFromOnboardingDrafts([drafts[1]!], deal)[0]!;
    expect(persisted.compensationProfile?.compensationType).toBe('REVENUE_SHARE');
    expect(persisted.compensationProfile?.percentage).toBe(12);
    expect(hasPersistedCompensationTerms(persisted)).toBe(true);
  });

  it('persists referral commission 15% for Affiliate Network Bali', () => {
    const drafts = onboardingDraftsFromExtraction(extraction, deal, 'whatsapp', 'AUD');
    const persisted = participantsFromOnboardingDrafts([drafts[2]!], deal)[0]!;
    expect(persisted.compensationProfile?.compensationType).toBe('COMMISSION');
    expect(persisted.compensationProfile?.percentage).toBe(15);
    expect(persisted.compensationProfile?.customerAttributionEnabled).toBe(true);
    expect(hasPersistedCompensationTerms(persisted)).toBe(true);
  });

  it('does not show Needs review when compensation is successfully extracted', () => {
    const drafts = onboardingDraftsFromExtraction(extraction, deal, 'whatsapp', 'AUD');
    const persisted = participantsFromOnboardingDrafts(drafts, deal);
    for (const participant of persisted) {
      const compensation = deriveCompensationState(hydrateParticipant(participant)._entity);
      expect(compensation.earningsPrimaryCompact).not.toBe('Needs review');
      expect(compensation.earningsSecondary).not.toBe('Compensation amount missing');
    }
  });

  it('creates exactly three participants on import (single persist)', () => {
    const drafts = onboardingDraftsFromExtraction(extraction, deal, 'whatsapp', 'AUD');
    const afterImport = participantsFromOnboardingDrafts(drafts, deal);
    expect(afterImport).toHaveLength(3);
    expect(new Set(afterImport.map((p) => p.name)).size).toBe(3);
  });

  it('regression: agreement review continue must not duplicate participants', () => {
    const drafts = onboardingDraftsFromExtraction(extraction, deal, 'whatsapp', 'AUD');
    const afterImport = participantsFromOnboardingDrafts(drafts, deal);
    // Fixed flow: persist once in handleImportExtract; handleAgreementReviewContinue no longer re-posts.
    const afterContinue = afterImport;
    expect(afterContinue).toHaveLength(3);
    expect(afterContinue.filter((p) => p.name === 'DJ Alex')).toHaveLength(1);
  });

  it('documents prior duplicate-append bug (import + continue would create six rows)', () => {
    const drafts = onboardingDraftsFromExtraction(extraction, deal, 'whatsapp', 'AUD');
    const afterImport = participantsFromOnboardingDrafts(drafts, deal);
    const afterDoubleAppend = appendOnboardingParticipants(afterImport, drafts, deal);
    expect(afterDoubleAppend).toHaveLength(6);
    expect(afterDoubleAppend.filter((p) => p.name === 'DJ Alex')).toHaveLength(2);
  });

  it('materializes DJ Alex fixed fee as a project-obligation line when deal value is zero', () => {
    const zeroDeal: RecentDeal = { ...deal, value: 0 };
    const drafts = onboardingDraftsFromExtraction(extraction, zeroDeal, 'whatsapp', 'AUD');
    const persisted = participantsFromOnboardingDrafts(drafts, zeroDeal);
    const dj = persisted.find((p) => p.name === 'DJ Alex')!;
    const owed = resolveParticipantCommissionUsd(
      { commissionKind: dj.commissionKind, commissionValue: dj.commissionValue },
      zeroDeal.value
    );
    expect(owed.total).toBe(2000);
  });
});
