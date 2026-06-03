import { describe, expect, it } from '@jest/globals';
import {
  buildPartyLifecycleRows,
  classifyTrackedParty,
  computeFirstLossAtStage,
  expectationsFromExtractionResult,
} from '@/lib/ai-extractor/review-form-lifecycle-instrumentation';
import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import type { ReviewFormState } from '@/lib/ai-extractor/review-form-types';

function field<T>(value: T) {
  return { value, confidence: 'high' as const, sourceQuote: null };
}

function minimalResult(parties: ExtractionResult['parties']): ExtractionResult {
  return {
    projectName: field('Test'),
    projectDescription: field(''),
    projectValue: field(10000),
    currency: field('AUD'),
    counterparty: field(''),
    parties,
    uncertainties: [],
    extractionVersion: 'test',
  };
}

describe('review-form-lifecycle-instrumentation', () => {
  it('classifies Island DJs and Coastal Promotions', () => {
    expect(classifyTrackedParty('Island DJs')).toBe('island_djs');
    expect(classifyTrackedParty('Coastal Promotions')).toBe('coastal_promotions');
  });

  it('detects first loss of Island fixed amount and Coastal revenue %', () => {
    const result = minimalResult([
      {
        id: 'p1',
        name: field('Island DJs'),
        email: field(''),
        role: field('Performer'),
        participationModel: field('fixed_payout'),
        fixedAmount: field(2500),
        revenueSharePct: field(null),
        notes: field(''),
      },
      {
        id: 'p2',
        name: field('Coastal Promotions'),
        email: field(''),
        role: field('Promoter'),
        participationModel: field('revenue_share'),
        fixedAmount: field(null),
        revenueSharePct: field(15),
        notes: field(''),
      },
    ] as ExtractionResult['parties']);

    const expectations = expectationsFromExtractionResult(result);
    expect(expectations.islandDjsFixedAmount).toBe(2500);
    expect(expectations.coastalRevenueSharePct).toBe(15);

    const form: ReviewFormState = {
      entryPoint: 'participant_add',
      existingDealId: 'deal-1',
      sourceType: 'whatsapp',
      projectName: 'Test',
      projectDescription: '',
      projectValue: 10000,
      currency: 'AUD',
      counterparty: '',
      parties: [
        {
          id: 'p1',
          name: 'Island DJs',
          email: '',
          role: 'Performer',
          participationModel: 'fixed_payout',
          fixedAmount: null,
          revenueSharePct: null,
          notes: '',
        },
        {
          id: 'p2',
          name: 'Coastal Promotions',
          email: '',
          role: 'Promoter',
          participationModel: 'revenue_share',
          fixedAmount: null,
          revenueSharePct: null,
          notes: '',
        },
      ],
      duplicateResolutions: { p1: 'update', p2: 'update' },
      extractedCurrencyCode: 'AUD',
      extractedCurrencyUnsupported: false,
    };

    const originalsById = new Map(result.parties.map((p) => [p.id, p]));
    const rows = buildPartyLifecycleRows(form, originalsById);
    const firstLoss = computeFirstLossAtStage(
      'useEffect.reinit.afterSetFormCommitted',
      rows,
      expectations,
      { islandDjsFixedAmount2500: null, coastalRevenueSharePct15: null }
    );

    expect(firstLoss.islandDjsFixedAmount2500).toBe('useEffect.reinit.afterSetFormCommitted');
    expect(firstLoss.coastalRevenueSharePct15).toBe('useEffect.reinit.afterSetFormCommitted');
  });
});
