import { describe, expect, it } from '@jest/globals';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  resolveCommissionWithValidation,
  resolveParticipantCommissionUsd,
} from '@/lib/deal-network-demo/commission-structure';
import {
  countProjectObligationEligibleParticipants,
  usesAttributionCommissionSettlement,
  usesProjectObligationSettlement,
} from '@/lib/operations/derivations/derive-compensation-settlement-basis';
import {
  onboardingDraftsFromExtraction,
  participantsFromOnboardingDrafts,
} from '@/lib/onboarding/onboarding-participant-persist';
import type { ExtractionResult, ExtractedParty } from '@/lib/ai-extractor/extraction-types';

function field<T>(value: T, confidence: 'high' | 'medium' | 'low' | 'absent' = 'high') {
  return { value, confidence };
}

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
      notes: field(null),
    },
    {
      id: 'ep-2',
      name: field('Coastal Promotions'),
      email: field(null, 'absent'),
      role: field('Partner'),
      participationModel: field('revenue_share'),
      fixedAmount: field(null, 'absent'),
      revenueSharePct: field(12),
      notes: field(null),
    },
    {
      id: 'ep-3',
      name: field('Affiliate Network Bali'),
      email: field(null, 'absent'),
      role: field('Referrer'),
      participationModel: field('customer_attribution'),
      fixedAmount: field(null, 'absent'),
      revenueSharePct: field(15),
      notes: field(null),
    },
  ];

  return {
    projectName: field('Venue Event Agreement'),
    projectDescription: field(null),
    projectValue: field(null, 'absent'),
    currency: field('AUD'),
    counterparty: field(null, 'absent'),
    parties,
    paymentTerms: [],
    uncertainties: [],
    overallConfidence: 'high',
    sourceHint: 'whatsapp',
    extractedAt: '2026-06-07T12:00:00.000Z',
  };
}

function zeroValueDeal(): RecentDeal {
  return {
    id: 'deal-zero',
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

describe('fixed-fee obligation generation', () => {
  it('resolves fixed fee when deal.value is 0', () => {
    const resolved = resolveCommissionWithValidation(
      { commissionKind: 'fixed_amount', commissionValue: 2000 },
      { dealValue: 0 }
    );
    expect(resolved.valid).toBe(true);
    expect(resolved.total).toBe(2000);

    const usd = resolveParticipantCommissionUsd(
      { commissionKind: 'fixed_amount', commissionValue: 2000 },
      0
    );
    expect(usd.total).toBe(2000);
  });

  it('onboarding import produces project-obligation lines for fixed fee and revenue share', () => {
    const deal = zeroValueDeal();
    const drafts = onboardingDraftsFromExtraction(venueTermsExtractionResult(), deal, 'whatsapp', 'AUD');
    const persisted = participantsFromOnboardingDrafts(drafts, deal);

    const dj = persisted.find((p) => p.name === 'DJ Alex')!;
    const coastal = persisted.find((p) => p.name === 'Coastal Promotions')!;
    const affiliate = persisted.find((p) => p.name === 'Affiliate Network Bali')!;

    expect(usesProjectObligationSettlement(dj)).toBe(true);
    expect(usesProjectObligationSettlement(coastal)).toBe(true);
    expect(usesProjectObligationSettlement(affiliate)).toBe(false);
    expect(usesAttributionCommissionSettlement(affiliate)).toBe(true);

    const djOwed = resolveParticipantCommissionUsd(
      {
        commissionKind: dj.commissionKind,
        commissionValue: dj.commissionValue,
      },
      deal.value
    );
    expect(djOwed.total).toBe(2000);

    const coastalOwed = resolveParticipantCommissionUsd(
      {
        commissionKind: coastal.commissionKind,
        commissionValue: coastal.commissionValue,
      },
      deal.value
    );
    expect(coastalOwed.total).toBe(0);

    expect(countProjectObligationEligibleParticipants(persisted, deal.id)).toBe(2);
  });

  it('excludes attribution participants from project obligation eligibility count', () => {
    const affiliate = {
      id: 'aff-1',
      dealId: 'deal-zero',
      name: 'Affiliate Network Bali',
      participationModel: 'customer_attribution',
      commissionKind: 'catalog_attribution',
      commissionValue: 15,
      compensationProfile: {
        compensationType: 'COMMISSION',
        percentage: 15,
        customerAttributionEnabled: true,
        configured: true,
      },
    } as DemoParticipant;

    expect(countProjectObligationEligibleParticipants([affiliate], 'deal-zero')).toBe(0);
  });
});
