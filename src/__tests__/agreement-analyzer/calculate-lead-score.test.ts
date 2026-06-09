import { calculateLeadScore } from '@/lib/agreement-analyzer/scoring/calculate-lead-score.server';
import { prisma } from '@/lib/server/prisma';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    agreement_obligation_reports: {
      findUnique: jest.fn(),
    },
    obligation_report_leads: {
      findUnique: jest.fn(),
    },
    obligation_report_email_events: {
      findMany: jest.fn(),
    },
    obligation_report_lead_scores: {
      create: jest.fn(),
    },
  },
}));

jest.mock('@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server', () => ({
  trackAgreementAnalyzerEvent: jest.fn(),
}));

describe('calculateLeadScore persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a new lead score row without overwriting prior scores', async () => {
    (prisma.agreement_obligation_reports.findUnique as jest.Mock).mockResolvedValue({
      id: 'report-1',
      status: 'COMPLETED',
      report_json: {
        parties: [{}, {}, {}],
        revenueSplits: [{ beneficiary: 'Promoter', percentage: 60, basis: 'revenue share' }],
        paymentConditions: [{}],
        obligations: [{}, {}],
        risks: [{}],
        missingInformation: [],
        settlementReadiness: { score: 80, summary: 'Ready', factors: [] },
      },
      viewed_at: null,
      upload: {
        lead: { id: 'lead-1' },
        agreement_ai_extractions: [
          {
            extraction_json: {
              documentType: 'promoter-revenue-share',
              parties: [{}, {}, {}],
            },
          },
        ],
      },
    });
    (prisma.obligation_report_leads.findUnique as jest.Mock).mockResolvedValue({
      lifecycle_stage: 'REPORT_GENERATED',
    });
    (prisma.obligation_report_email_events.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.obligation_report_lead_scores.create as jest.Mock).mockResolvedValue({
      id: 'score-1',
    });

    const result = await calculateLeadScore({ reportId: 'report-1' });

    expect(result?.leadId).toBe('lead-1');
    expect(result?.scoreId).toBe('score-1');
    expect(prisma.obligation_report_lead_scores.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        lead_id: 'lead-1',
        multi_party_detected: true,
        revenue_share_detected: true,
        recommended_use_case: expect.any(String),
        priority_band: expect.any(String),
      }),
    });
  });
});
