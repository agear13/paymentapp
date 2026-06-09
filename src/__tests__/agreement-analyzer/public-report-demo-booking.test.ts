import { getPublicObligationReportByToken } from '@/lib/agreement-analyzer/public-report.server';
import { prisma } from '@/lib/server/prisma';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    agreement_obligation_reports: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server', () => ({
  trackAgreementAnalyzerEvent: jest.fn(),
}));

describe('public obligation report demo booking', () => {
  const originalSecret = process.env.AGREEMENT_ANALYZER_TRACKING_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AGREEMENT_ANALYZER_TRACKING_SECRET = 'test-calendly-tracking-secret-value-32chars';
  });

  afterAll(() => {
    process.env.AGREEMENT_ANALYZER_TRACKING_SECRET = originalSecret;
  });

  it('returns a Calendly demo booking link with signed tracking for completed reports', async () => {
    (prisma.agreement_obligation_reports.findUnique as jest.Mock).mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
      status: 'COMPLETED',
      report_access_token: 'rpt_abcdefghij',
      created_at: new Date('2026-06-01T10:00:00.000Z'),
      viewed_at: null,
      settlement_readiness_score: 78,
      report_json: {
        parties: [],
        revenueSplits: [],
        paymentConditions: [],
        obligations: [],
        risks: [],
        missingInformation: [],
        settlementReadiness: { score: 78, summary: 'Ready', factors: [] },
      },
      upload: {
        original_filename: 'promoter-agreement.pdf',
        lead: {
          id: '11111111-1111-4111-8111-111111111111',
          company_name: 'Harbour Events',
          business_type: 'Hospitality',
          obligation_report_lead_scores: [
            {
              overall_score: 75,
              priority_band: 'HIGH',
              recommended_use_case: 'Event Revenue Sharing',
            },
          ],
        },
        agreement_ai_extractions: [],
      },
    });

    const report = await getPublicObligationReportByToken('rpt_abcdefghij');

    expect(report?.demoBooking).toMatchObject({
      leadId: '11111111-1111-4111-8111-111111111111',
      reportId: '22222222-2222-4222-8222-222222222222',
      overallScore: 75,
      priorityBand: 'HIGH',
      recommendedUseCase: 'Event Revenue Sharing',
    });
    expect(report?.demoBooking?.url).toContain('https://calendly.com/provvypay/demo?tracking=');
    expect(report?.demoBooking?.url).not.toContain('11111111-1111-4111-8111-111111111111');
  });
});
