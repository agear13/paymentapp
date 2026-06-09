import { getAgreementAnalyzerAttributionAnalytics } from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-attribution-analytics.server';
import { getAgreementAnalyzerAnalytics } from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-analytics.server';
import { prisma } from '@/lib/server/prisma';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    agreement_obligation_reports: {
      count: jest.fn(),
    },
    obligation_report_email_events: {
      count: jest.fn(),
    },
    obligation_report_leads: {
      count: jest.fn(),
    },
    agreement_analyzer_demo_bookings: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

jest.mock('@/lib/agreement-analyzer/demo-bookings/demo-bookings.server', () => ({
  countDemoBookings: jest.fn().mockResolvedValue(4),
}));

jest.mock('@/lib/agreement-analyzer/dashboard/agreement-analyzer-attribution-analytics.server', () => ({
  getAgreementAnalyzerAttributionAnalytics: jest.fn().mockResolvedValue({
    topConvertingUseCases: [{ label: 'Venue Settlement', count: 2, percentage: 50 }],
    topConvertingBusinessTypes: [{ label: 'Hospitality', count: 2, percentage: 50 }],
    topConvertingPriorityBands: [{ label: 'HIGH', count: 2, percentage: 50 }],
  }),
}));

jest.mock('@/lib/agreement-analyzer/dashboard/marketing-attribution-analytics.server', () => ({
  getAgreementAnalyzerMarketingAttributionAnalytics: jest.fn().mockResolvedValue({
    topSources: { uploads: [], reportsViewed: [], demoBookings: [] },
    topCampaigns: { uploads: [], demoBookings: [] },
    topReferrers: { uploads: [], demoBookings: [] },
    funnelBySource: [],
    funnelByCampaign: [],
    funnelByMedium: [],
  }),
}));

describe('agreement analyzer dashboard analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('aggregates funnel metrics and daily series', async () => {
    (prisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([{ day: new Date('2026-06-01T00:00:00.000Z'), count: 2n }])
      .mockResolvedValueOnce([{ day: new Date('2026-06-01T00:00:00.000Z'), count: 1n }])
      .mockResolvedValueOnce([{ day: new Date('2026-06-01T00:00:00.000Z'), count: 68 }])
      .mockResolvedValueOnce([{ count: 5n }])
      .mockResolvedValueOnce([{ count: 3n }]);

    (prisma.agreement_obligation_reports.count as jest.Mock)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(6);

    (prisma.obligation_report_email_events.count as jest.Mock)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(4);

    (prisma.obligation_report_leads.count as jest.Mock).mockResolvedValue(2);
    (getAgreementAnalyzerAttributionAnalytics as jest.Mock).mockResolvedValue({
      topConvertingUseCases: [{ label: 'Venue Settlement', count: 2, percentage: 66.7 }],
      topConvertingBusinessTypes: [{ label: 'Hospitality', count: 2, percentage: 66.7 }],
      topConvertingPriorityBands: [{ label: 'HIGH', count: 2, percentage: 66.7 }],
    });

    const analytics = await getAgreementAnalyzerAnalytics();

    expect(analytics.reportViewRate).toBe(60);
    expect(analytics.emailOpenRate).toBe(50);
    expect(analytics.demoClickRate).toBe(33.3);
    expect(analytics.demoConversionRate).toBe(66.7);
    expect(analytics.revenueShareDetectionRate).toBe(60);
    expect(analytics.topConvertingUseCases[0]?.label).toBe('Venue Settlement');
    expect(analytics.leadsPerDay).toHaveLength(30);
    expect(analytics.leadsPerDay.find((row) => row.count === 2)).toBeDefined();
    expect(analytics.reportsGeneratedPerDay.find((row) => row.count === 1)).toBeDefined();
    expect(analytics.averageLeadScoreTrend.find((row) => row.count === 68)).toBeDefined();
  });
});
