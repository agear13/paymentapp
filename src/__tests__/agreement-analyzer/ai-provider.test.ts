import { getAgreementExtractionProvider } from '@/lib/agreement-analyzer/ai/get-agreement-extraction-provider';
import { resolveAgreementExtractionProviderId } from '@/lib/agreement-analyzer/ai/provider-config';
import { parseJsonFromModelResponse } from '@/lib/agreement-analyzer/ai/parse-json-response';
import { formatBenchmarkComparisonMarkdown } from '@/lib/agreement-analyzer/evaluation/compare-benchmark-providers';
import type { BenchmarkReport } from '@/lib/agreement-analyzer/evaluation/evaluation-types';

describe('agreement extraction provider abstraction', () => {
  const originalProvider = process.env.AGREEMENT_EXTRACTION_PROVIDER;

  afterEach(() => {
    if (originalProvider === undefined) {
      delete process.env.AGREEMENT_EXTRACTION_PROVIDER;
    } else {
      process.env.AGREEMENT_EXTRACTION_PROVIDER = originalProvider;
    }
  });

  it('defaults to claude when provider env is unset', () => {
    delete process.env.AGREEMENT_EXTRACTION_PROVIDER;
    expect(resolveAgreementExtractionProviderId()).toBe('claude');
    expect(getAgreementExtractionProvider().id).toBe('claude');
  });

  it('honors explicit provider overrides', () => {
    expect(resolveAgreementExtractionProviderId('openai')).toBe('openai');
    expect(getAgreementExtractionProvider('openai').id).toBe('openai');
  });

  it('parses fenced JSON model responses', () => {
    const parsed = parseJsonFromModelResponse('```json\n{"documentType":"venue-hire"}\n```');
    expect(parsed).toEqual({ documentType: 'venue-hire' });
  });
});

describe('benchmark provider comparison', () => {
  const baseReport = (provider: 'claude' | 'openai', overall: number): BenchmarkReport => ({
    generatedAt: '2026-06-09T00:00:00.000Z',
    samplesDirectory: 'sample-agreements',
    provider: { provider, model: provider === 'claude' ? 'claude-sonnet-4-6' : 'gpt-4o' },
    extraction: { processed: 20, succeeded: 20, failed: 0 },
    overallMetrics: {
      relationshipClassification: overall,
      parties: overall,
      revenueSplits: overall,
      obligations: overall,
      risks: overall,
      missingClauses: overall,
      overall,
    },
    perAgreement: [],
    topPerformers: [],
    bottomPerformers: [],
    failureAnalysis: [],
    categorySummaries: {
      revenueShare: {
        count: 5,
        relationshipClassification: overall,
        parties: overall,
        revenueSplits: overall,
        obligations: overall,
        risks: overall,
        missingClauses: overall,
        overall,
      },
      event: {
        count: 5,
        relationshipClassification: overall,
        parties: overall,
        revenueSplits: overall,
        obligations: overall,
        risks: overall,
        missingClauses: overall,
        overall,
      },
      service: {
        count: 5,
        relationshipClassification: overall,
        parties: overall,
        revenueSplits: overall,
        obligations: overall,
        risks: overall,
        missingClauses: overall,
        overall,
      },
      partnership: {
        count: 5,
        relationshipClassification: overall,
        parties: overall,
        revenueSplits: overall,
        obligations: overall,
        risks: overall,
        missingClauses: overall,
        overall,
      },
    },
    difficultySummaries: {
      simple: {
        count: 5,
        relationshipClassification: overall,
        parties: overall,
        revenueSplits: overall,
        obligations: overall,
        risks: overall,
        missingClauses: overall,
        overall,
      },
      medium: {
        count: 10,
        relationshipClassification: overall,
        parties: overall,
        revenueSplits: overall,
        obligations: overall,
        risks: overall,
        missingClauses: overall,
        overall,
      },
      complex: {
        count: 5,
        relationshipClassification: overall,
        parties: overall,
        revenueSplits: overall,
        obligations: overall,
        risks: overall,
        missingClauses: overall,
        overall,
      },
    },
  });

  it('formats provider comparison markdown', () => {
    const markdown = formatBenchmarkComparisonMarkdown(baseReport('claude', 82), baseReport('openai', 76));
    expect(markdown).toContain('Agreement Benchmark Provider Comparison');
    expect(markdown).toContain('claude-sonnet-4-6');
    expect(markdown).toContain('+6.0');
  });
});
