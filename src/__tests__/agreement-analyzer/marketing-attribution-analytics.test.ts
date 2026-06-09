import { getAgreementAnalyzerMarketingAttributionAnalytics } from '@/lib/agreement-analyzer/dashboard/marketing-attribution-analytics.server';
import { prisma } from '@/lib/server/prisma';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    obligation_report_leads: {
      findMany: jest.fn(),
    },
  },
}));

describe('marketing attribution analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('aggregates top sources, campaigns, referrers, and funnel conversion rates', async () => {
    (prisma.obligation_report_leads.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'lead-1',
        utm_source: 'linkedin',
        utm_medium: 'organic',
        utm_campaign: 'agreement-analyzer-launch',
        referrer: 'https://www.linkedin.com/feed/',
        lifecycle_stage: 'DEMO_BOOKED',
        agreement_uploads: [
          {
            agreement_obligation_reports: [{ viewed_at: new Date('2026-06-01T00:00:00.000Z') }],
          },
        ],
        agreement_analyzer_demo_bookings: [{ id: 'booking-1' }],
      },
      {
        id: 'lead-2',
        utm_source: 'linkedin',
        utm_medium: 'organic',
        utm_campaign: 'agreement-analyzer-launch',
        referrer: 'https://provvypay.com/',
        lifecycle_stage: 'REPORT_VIEWED',
        agreement_uploads: [
          {
            agreement_obligation_reports: [{ viewed_at: new Date('2026-06-02T00:00:00.000Z') }],
          },
        ],
        agreement_analyzer_demo_bookings: [],
      },
      {
        id: 'lead-3',
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        referrer: null,
        lifecycle_stage: 'NEW',
        agreement_uploads: [
          {
            agreement_obligation_reports: [{ viewed_at: null }],
          },
        ],
        agreement_analyzer_demo_bookings: [],
      },
    ]);

    const analytics = await getAgreementAnalyzerMarketingAttributionAnalytics();

    expect(analytics.topSources.uploads[0]).toEqual({
      label: 'linkedin',
      count: 2,
      percentage: 66.7,
    });
    expect(analytics.topSources.reportsViewed[0]).toEqual({
      label: 'linkedin',
      count: 2,
      percentage: 100,
    });
    expect(analytics.topSources.demoBookings[0]).toEqual({
      label: 'linkedin',
      count: 1,
      percentage: 100,
    });
    expect(analytics.topCampaigns.uploads[0]?.label).toBe('agreement-analyzer-launch');
    expect(analytics.topReferrers.uploads.map((item) => item.label)).toEqual(
      expect.arrayContaining(['linkedin.com', 'provvypay.com'])
    );

    const linkedinFunnel = analytics.funnelBySource.find((row) => row.label === 'linkedin');
    expect(linkedinFunnel).toEqual({
      label: 'linkedin',
      uploads: 2,
      reportsViewed: 2,
      demoBooked: 1,
      customers: 0,
      uploadToReportViewedRate: 100,
      reportViewedToDemoBookedRate: 50,
      demoBookedToCustomerRate: 0,
    });
  });
});
