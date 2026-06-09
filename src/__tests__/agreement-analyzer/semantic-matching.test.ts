import {
  flattenRevenueSplitItems,
  partiesSemanticallyMatch,
  revenueSplitsSemanticallyMatch,
  scoreMinimumCountAlignment,
  scoreRelationshipClassificationSemantic,
} from '@/lib/agreement-analyzer/evaluation/semantic-matching';
import { scoreAgreementEvaluation } from '@/lib/agreement-analyzer/evaluation/scoring';
import type { ExpectedAgreementEvaluation } from '@/lib/agreement-analyzer/evaluation/evaluation-types';
import { normalizeActualExtraction } from '@/lib/agreement-analyzer/evaluation/normalize-actual-extraction';

describe('semantic benchmark matching', () => {
  it('matches parties with extra extracted fields and role synonyms', () => {
    const expected = { name: 'Harbour Events Pty Ltd', role: 'Venue Operator' };
    const actual = {
      name: 'Harbour Events Pty Ltd',
      entityType: 'Proprietary Limited Company',
      abn: '81 234 567 890',
      role: 'Venue Operator',
    };

    expect(partiesSemanticallyMatch(expected, actual)).toBe(true);
  });

  it('matches parties when role is stored as alias', () => {
    const expected = { name: 'Nina Sol Entertainment', role: 'DJ' };
    const actual = { name: 'Nina Sol Entertainment', alias: 'DJ' };
    expect(partiesSemanticallyMatch(expected, actual)).toBe(true);
  });

  it('flattens nested revenue split groups before matching', () => {
    const expected = {
      party: 'Harbour Events Pty Ltd',
      percentage: 30,
      basis: 'Net Door Receipts',
    };
    const actual = [
      {
        metric: 'Net Door Receipts',
        definition: 'Gross ticket and door sales less card processing fees and refunds',
        splits: [{ beneficiary: 'Harbour Events Pty Ltd', percentage: 30 }],
      },
    ];

    expect(
      revenueSplitsSemanticallyMatch(expected, flattenRevenueSplitItems(actual)[0])
    ).toBe(true);
  });

  it('matches revenue splits using beneficiary instead of party', () => {
    const expected = {
      party: 'Pulse Promotions Pty Ltd',
      percentage: 70,
      basis: 'Net Door Receipts',
    };
    const actual = {
      beneficiary: 'Pulse Promotions Pty Ltd',
      percentage: 70,
      basis: 'Net Door Receipts',
      trigger: 'Each Event Night',
    };

    expect(revenueSplitsSemanticallyMatch(expected, actual)).toBe(true);
  });

  it('rewards meeting minimum counts instead of penalizing over-extraction to zero', () => {
    expect(scoreMinimumCountAlignment(2, 8).score).toBeGreaterThan(80);
    expect(scoreMinimumCountAlignment(5, 6).score).toBeGreaterThanOrEqual(95);
  });

  it('maps agreement titles to benchmark relationship slugs', () => {
    const result = scoreRelationshipClassificationSemantic(
      'promoter-revenue-share',
      'Nightlife Promotion and Door Receipts Agreement'
    );
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it('scores promoter-revenue-share fixture highly under semantic scoring', () => {
    const expected: ExpectedAgreementEvaluation = {
      commercialRelationshipType: 'promoter-revenue-share',
      parties: [
        { name: 'Harbour Events Pty Ltd', role: 'Venue Operator' },
        { name: 'Pulse Promotions Pty Ltd', role: 'Promoter' },
      ],
      revenueSplits: [
        { party: 'Pulse Promotions Pty Ltd', percentage: 70, basis: 'Net Door Receipts' },
        { party: 'Harbour Events Pty Ltd', percentage: 30, basis: 'Net Door Receipts' },
      ],
      obligationCount: 5,
      riskCount: 2,
      missingClauseCount: 2,
    };

    const actual = normalizeActualExtraction({
      documentType: 'Nightlife Promotion and Door Receipts Agreement',
      parties: [
        { name: 'Harbour Events Pty Ltd', role: 'Venue Operator' },
        { name: 'Pulse Promotions Pty Ltd', role: 'Promoter' },
      ],
      revenueSplits: [
        { beneficiary: 'Pulse Promotions Pty Ltd', percentage: 70, basis: 'Net Door Receipts' },
        { beneficiary: 'Harbour Events Pty Ltd', percentage: 30, basis: 'Net Door Receipts' },
      ],
      obligations: [{}, {}, {}, {}, {}, {}],
      risks: [{}, {}, {}, {}, {}, {}, {}, {}],
      missingInformation: Array.from({ length: 12 }, () => ({})),
      confidenceScore: 0.9,
    });

    const result = scoreAgreementEvaluation('promoter-revenue-share', expected, actual!);
    expect(result.metrics.parties.score).toBe(100);
    expect(result.metrics.revenueSplits.score).toBe(100);
    expect(result.metrics.risks.score).toBeGreaterThan(80);
    expect(result.metrics.missingClauses.score).toBeGreaterThanOrEqual(80);
    expect(result.metrics.overall).toBeGreaterThan(85);
  });
});
