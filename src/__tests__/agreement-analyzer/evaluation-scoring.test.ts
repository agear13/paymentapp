import { normalizeActualExtraction } from '@/lib/agreement-analyzer/evaluation/normalize-actual-extraction';
import { scoreAgreementEvaluation } from '@/lib/agreement-analyzer/evaluation/scoring';
import type { ExpectedAgreementEvaluation } from '@/lib/agreement-analyzer/evaluation/evaluation-types';

const baseExpected: ExpectedAgreementEvaluation = {
  commercialRelationshipType: 'promoter-revenue-share',
  parties: [{ name: 'Promoter Co', role: 'Promoter' }],
  revenueSplits: [{ beneficiary: 'Venue', percentage: 60 }],
  obligationCount: 2,
  riskCount: 1,
  missingClauseCount: 1,
};

describe('agreement extraction evaluation scoring', () => {
  it('scores strong alignment highly', () => {
    const actual = normalizeActualExtraction({
      documentType: 'promoter-revenue-share',
      parties: [{ name: 'Promoter Co', role: 'Promoter' }],
      revenueSplits: [{ beneficiary: 'Venue', percentage: 60 }],
      obligations: [{ description: 'Pay guarantee' }, { description: 'Submit settlement report' }],
      risks: [{ issue: 'Unclear cancellation clause' }],
      missingInformation: [{ field: 'Tax invoice details' }],
      confidenceScore: 0.9,
    });

    const result = scoreAgreementEvaluation('promoter-revenue-share', baseExpected, actual!);
    expect(result.metrics.relationshipClassification.score).toBeGreaterThanOrEqual(70);
    expect(result.metrics.parties.score).toBeGreaterThanOrEqual(90);
    expect(result.metrics.revenueSplits.score).toBeGreaterThanOrEqual(90);
    expect(result.metrics.obligations.score).toBe(100);
    expect(result.metrics.overall).toBeGreaterThanOrEqual(85);
  });

  it('penalizes missing actual items', () => {
    const actual = normalizeActualExtraction({
      parties: [],
      revenueSplits: [],
      obligations: [],
      risks: [],
      missingInformation: [],
      confidenceScore: 0.2,
    });

    const result = scoreAgreementEvaluation('promoter-revenue-share', baseExpected, actual!);
    expect(result.metrics.parties.score).toBe(0);
    expect(result.metrics.obligations.score).toBe(0);
    expect(result.metrics.overall).toBeLessThan(30);
  });
});
