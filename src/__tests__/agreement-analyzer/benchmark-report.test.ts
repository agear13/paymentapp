import { buildBenchmarkReport, formatBenchmarkMarkdown } from '@/lib/agreement-analyzer/evaluation/benchmark-report';
import type {
  BenchmarkPerAgreementResult,
  ExpectedAgreementEvaluation,
} from '@/lib/agreement-analyzer/evaluation/evaluation-types';
import { scoreAgreementEvaluation } from '@/lib/agreement-analyzer/evaluation/scoring';
import { normalizeActualExtraction } from '@/lib/agreement-analyzer/evaluation/normalize-actual-extraction';

const expected: ExpectedAgreementEvaluation = {
  commercialRelationshipType: 'promoter-revenue-share',
  category: 'revenueShare',
  difficulty: 'simple',
  parties: [{ name: 'Promoter Co', role: 'Promoter' }],
  revenueSplits: [{ beneficiary: 'Venue', percentage: 60 }],
  obligationCount: 2,
  riskCount: 1,
  missingClauseCount: 1,
};

function buildResult(agreementId: string, overallSeed: number): BenchmarkPerAgreementResult {
  const actual = normalizeActualExtraction({
    documentType: overallSeed > 50 ? 'promoter-revenue-share' : 'unknown-type',
    parties: overallSeed > 50 ? expected.parties : [],
    revenueSplits: overallSeed > 50 ? expected.revenueSplits : [],
    obligations: overallSeed > 50 ? [{}, {}] : [],
    risks: overallSeed > 50 ? [{}] : [],
    missingInformation: overallSeed > 50 ? [{}] : [],
    confidenceScore: 0.8,
  });

  return {
    ...scoreAgreementEvaluation(agreementId, expected, actual!),
    extractionStatus: 'success',
  };
}

describe('benchmark report builder', () => {
  it('builds top/bottom performers and failure analysis', () => {
    const high = buildResult('high-score', 90);
    const low = buildResult('low-score', 10);
    const actualByAgreementId = {
      'high-score': { extraction: { documentType: 'promoter-revenue-share', parties: [], revenueSplits: [], obligations: [{}, {}], risks: [{}], missingInformation: [{}], confidenceScore: 0.8 } },
      'low-score': { extraction: { documentType: 'unknown-type', parties: [], revenueSplits: [], obligations: [], risks: [], missingInformation: [], confidenceScore: 0.2 } },
    };

    const report = buildBenchmarkReport({
      samplesDirectory: '/tmp/sample-agreements',
      provider: { provider: 'claude', model: 'claude-sonnet-4-6' },
      extraction: { processed: 2, succeeded: 2, failed: 0 },
      perAgreement: [low, high],
      actualByAgreementId,
      expectedByAgreementId: {
        'high-score': expected,
        'low-score': expected,
      },
    });

    expect(report.topPerformers[0]?.agreementId).toBe('high-score');
    expect(report.bottomPerformers[0]?.agreementId).toBe('low-score');
    expect(report.failureAnalysis.some((item) => item.agreementId === 'low-score')).toBe(true);
    expect(report.categorySummaries.revenueShare.count).toBe(2);
    expect(formatBenchmarkMarkdown(report)).toContain('Agreement Extraction Benchmark Report');
  });
});
