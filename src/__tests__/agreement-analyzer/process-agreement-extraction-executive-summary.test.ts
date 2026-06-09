import { processAgreementExtraction } from '@/lib/agreement-analyzer/extraction/process-agreement-extraction.server';
import { getAgreementUploadStorage } from '@/lib/agreement-analyzer/upload-storage';
import { runProductionAgreementExtraction } from '@/lib/agreement-analyzer/extraction/run-production-extraction.server';
import { enrichReportJsonWithExecutiveSummary } from '@/lib/agreement-analyzer/extraction/generate-executive-summary.server';
import { prisma } from '@/lib/server/prisma';

jest.mock('@/lib/agreement-analyzer/upload-storage', () => ({
  getAgreementUploadStorage: jest.fn(),
}));

jest.mock('@/lib/agreement-analyzer/extraction/run-production-extraction.server', () => ({
  runProductionAgreementExtraction: jest.fn(),
}));

jest.mock('@/lib/agreement-analyzer/extraction/generate-executive-summary.server', () => ({
  enrichReportJsonWithExecutiveSummary: jest.fn(),
}));

jest.mock('@/lib/agreement-analyzer/email/send-report-ready-email.server', () => ({
  scheduleReportReadyEmail: jest.fn(),
}));

jest.mock('@/lib/agreement-analyzer/scoring/calculate-lead-score.server', () => ({
  scheduleLeadScoreCalculation: jest.fn(),
}));

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    agreement_obligation_reports: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    agreement_uploads: {
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    agreement_ai_extractions: {
      create: jest.fn(),
    },
    obligation_report_leads: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const baseReportJson = {
  parties: [{ name: 'Harbour Events' }],
  revenueSplits: [],
  paymentConditions: [],
  obligations: [{ obligation: 'Pay share' }],
  risks: [],
  missingInformation: [],
  settlementReadiness: {
    score: 72,
    summary: 'Agreement has gaps that should be resolved before settlement.',
    factors: [],
  },
};

describe('processAgreementExtraction executive summary persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (prisma.agreement_obligation_reports.findUnique as jest.Mock).mockResolvedValue({
      id: 'report-1',
      upload: {
        id: 'upload-1',
        storage_key: 'agreements/test.pdf',
        mime_type: 'application/pdf',
      },
    });
    (prisma.agreement_obligation_reports.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.agreement_uploads.update as jest.Mock).mockResolvedValue({});
    (prisma.agreement_ai_extractions.create as jest.Mock).mockResolvedValue({ id: 'extraction-1' });
    (prisma.$transaction as jest.Mock).mockResolvedValue([]);
    (getAgreementUploadStorage as jest.Mock).mockReturnValue({
      download: jest.fn().mockResolvedValue({ bytes: Buffer.from('pdf') }),
    });
    (runProductionAgreementExtraction as jest.Mock).mockResolvedValue({
      success: true,
      extraction: {
        documentType: 'promoter-revenue-share',
        parties: baseReportJson.parties,
        roles: [],
        revenueSplits: [],
        paymentConditions: [],
        obligations: baseReportJson.obligations,
        risks: [],
        missingInformation: [],
        confidenceScore: 0.8,
      },
      reportJson: baseReportJson,
      extractedText: 'Agreement text',
      modelName: 'claude-sonnet-4-6',
      providerId: 'claude',
      processingDurationMs: 1200,
    });
  });

  it('persists report_json with executiveSummary and settlementSimulation when enrichment succeeds', async () => {
    const enrichedReport = {
      ...baseReportJson,
      executiveSummary: {
        headline: 'Revenue Sharing Agreement',
        summary: 'Concise summary.',
        keyFindings: ['GST treatment is not defined'],
        operationalImpact: 'Manual settlement may be error-prone.',
      },
      settlementSimulation: {
        supported: true,
        simulationRevenue: 10_000,
        participants: [
          {
            party: 'Harbour Events',
            percentage: 100,
            estimatedPayout: 10_000,
          },
        ],
      },
    };
    (enrichReportJsonWithExecutiveSummary as jest.Mock).mockResolvedValue({
      ...baseReportJson,
      executiveSummary: enrichedReport.executiveSummary,
    });

    const result = await processAgreementExtraction({ reportId: 'report-1' });

    expect(result.success).toBe(true);
    expect(enrichReportJsonWithExecutiveSummary).toHaveBeenCalledWith({
      extractionJson: expect.objectContaining({ documentType: 'promoter-revenue-share' }),
      reportJson: baseReportJson,
      settlementReadinessScore: 72,
    });
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.agreement_obligation_reports.update).toHaveBeenCalledWith({
      where: { id: 'report-1' },
      data: {
        status: 'COMPLETED',
        report_json: expect.objectContaining({
          executiveSummary: enrichedReport.executiveSummary,
          settlementSimulation: expect.objectContaining({
            supported: false,
            simulationRevenue: 10_000,
          }),
          provvypayFit: expect.objectContaining({
            fitScore: expect.any(Number),
            recommendedUseCase: expect.any(String),
          }),
          settlementRiskAssessment: expect.objectContaining({
            riskScore: expect.any(Number),
            riskLevel: expect.any(String),
          }),
        }),
        settlement_readiness_score: 72,
      },
    });
  });

  it('still completes extraction when executive summary enrichment is omitted', async () => {
    (enrichReportJsonWithExecutiveSummary as jest.Mock).mockResolvedValue(baseReportJson);

    const result = await processAgreementExtraction({ reportId: 'report-1' });

    expect(result.success).toBe(true);
    expect(prisma.agreement_obligation_reports.update).toHaveBeenCalledWith({
      where: { id: 'report-1' },
      data: {
        status: 'COMPLETED',
        report_json: expect.objectContaining({
          ...baseReportJson,
          settlementSimulation: expect.objectContaining({
            supported: false,
            simulationRevenue: 10_000,
          }),
          provvypayFit: expect.objectContaining({
            fitScore: expect.any(Number),
            recommendedUseCase: expect.any(String),
          }),
          settlementRiskAssessment: expect.objectContaining({
            riskScore: expect.any(Number),
            riskLevel: expect.any(String),
          }),
        }),
        settlement_readiness_score: 72,
      },
    });
  });
});
