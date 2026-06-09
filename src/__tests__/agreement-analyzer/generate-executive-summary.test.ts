import { getAgreementExtractionProvider } from '@/lib/agreement-analyzer/ai/get-agreement-extraction-provider';
import {
  enrichReportJsonWithExecutiveSummary,
  generateExecutiveSummary,
} from '@/lib/agreement-analyzer/extraction/generate-executive-summary.server';
import type { AgreementReportJson } from '@/lib/agreement-analyzer/extraction/extraction-types';
import { parsePublicReportJson } from '@/lib/agreement-analyzer/report-types';

const mockGenerateExecutiveSummary = jest.fn();
const mockIsConfigured = jest.fn();

jest.mock('@/lib/agreement-analyzer/ai/get-agreement-extraction-provider', () => ({
  getAgreementExtractionProvider: jest.fn(() => ({
    isConfigured: mockIsConfigured,
    generateExecutiveSummary: mockGenerateExecutiveSummary,
  })),
}));

const baseReportJson: AgreementReportJson = {
  parties: [{ name: 'Harbour Events' }, { name: 'Pulse Promotions' }],
  revenueSplits: [{ beneficiary: 'Venue', percentage: 30 }],
  paymentConditions: [{ description: 'Weekly settlement' }],
  obligations: [{ obligation: 'Provide sales report' }, { obligation: 'Pay promoter share' }],
  risks: [{ description: 'Late settlement risk' }],
  missingInformation: [{ field: 'GST treatment' }],
  settlementReadiness: {
    score: 72,
    summary: 'Agreement has gaps that should be resolved before settlement.',
    factors: ['1 missing information item(s) detected.'],
  },
};

const sampleSummary = {
  headline: 'Revenue Sharing Agreement',
  summary:
    'This agreement appears to be a revenue-sharing arrangement between Harbour Events and Pulse Promotions.',
  keyFindings: ['GST treatment is not defined'],
  operationalImpact: 'These gaps may create payment disputes if managed manually.',
};

describe('parsePublicReportJson backward compatibility', () => {
  it('parses legacy report_json without executiveSummary', () => {
    const parsed = parsePublicReportJson(baseReportJson);
    expect(parsed).not.toBeNull();
    expect(parsed?.executiveSummary).toBeUndefined();
  });

  it('parses report_json with executiveSummary', () => {
    const parsed = parsePublicReportJson({
      ...baseReportJson,
      executiveSummary: sampleSummary,
    });
    expect(parsed?.executiveSummary).toEqual(sampleSummary);
  });
});

describe('generateExecutiveSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsConfigured.mockReturnValue(true);
  });

  it('returns a validated executive summary on success', async () => {
    mockGenerateExecutiveSummary.mockResolvedValue({
      summary: sampleSummary,
      modelName: 'claude-sonnet-4-6',
    });

    const result = await generateExecutiveSummary({
      extractionJson: {
        documentType: 'promoter-revenue-share',
        parties: baseReportJson.parties,
        obligations: baseReportJson.obligations,
        confidenceScore: 0.82,
      },
      reportJson: baseReportJson,
      settlementReadinessScore: 72,
    });

    expect(result).toEqual(sampleSummary);
    expect(getAgreementExtractionProvider).toHaveBeenCalledWith('claude');
    expect(mockGenerateExecutiveSummary).toHaveBeenCalledWith({
      extractionJson: expect.any(Object),
      reportJson: baseReportJson,
      settlementReadinessScore: 72,
    });
  });

  it('returns null when summary generation fails', async () => {
    mockGenerateExecutiveSummary.mockRejectedValue(new Error('Claude unavailable'));

    const result = await generateExecutiveSummary({
      extractionJson: { documentType: 'promoter-revenue-share' },
      reportJson: baseReportJson,
      settlementReadinessScore: 72,
    });

    expect(result).toBeNull();
  });

  it('returns null when Claude is not configured', async () => {
    mockIsConfigured.mockReturnValue(false);

    const result = await generateExecutiveSummary({
      extractionJson: { documentType: 'promoter-revenue-share' },
      reportJson: baseReportJson,
      settlementReadinessScore: 72,
    });

    expect(result).toBeNull();
    expect(mockGenerateExecutiveSummary).not.toHaveBeenCalled();
  });
});

describe('enrichReportJsonWithExecutiveSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsConfigured.mockReturnValue(true);
  });

  it('attaches executiveSummary to report_json when generation succeeds', async () => {
    mockGenerateExecutiveSummary.mockResolvedValue({
      summary: sampleSummary,
      modelName: 'claude-sonnet-4-6',
    });

    const enriched = await enrichReportJsonWithExecutiveSummary({
      extractionJson: { documentType: 'promoter-revenue-share' },
      reportJson: baseReportJson,
      settlementReadinessScore: 72,
    });

    expect(enriched.executiveSummary).toEqual(sampleSummary);
    expect(enriched.parties).toEqual(baseReportJson.parties);
  });

  it('returns the original report_json when generation fails', async () => {
    mockGenerateExecutiveSummary.mockRejectedValue(new Error('timeout'));

    const enriched = await enrichReportJsonWithExecutiveSummary({
      extractionJson: { documentType: 'promoter-revenue-share' },
      reportJson: baseReportJson,
      settlementReadinessScore: 72,
    });

    expect(enriched).toEqual(baseReportJson);
    expect(enriched.executiveSummary).toBeUndefined();
  });
});
