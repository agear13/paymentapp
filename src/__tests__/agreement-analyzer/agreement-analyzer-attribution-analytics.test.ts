import { getAgreementAnalyzerAttributionAnalytics } from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-attribution-analytics.server';
import { createCalendlyTrackingToken } from '@/lib/agreement-analyzer/calendly/calendly-attribution.server';
import { prisma } from '@/lib/server/prisma';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    agreement_analyzer_demo_bookings: {
      findMany: jest.fn(),
    },
  },
}));

describe('agreement analyzer attribution analytics', () => {
  const originalSecret = process.env.AGREEMENT_ANALYZER_TRACKING_SECRET;

  beforeEach(() => {
    process.env.AGREEMENT_ANALYZER_TRACKING_SECRET = 'test-calendly-tracking-secret-value-32chars';
  });

  afterAll(() => {
    process.env.AGREEMENT_ANALYZER_TRACKING_SECRET = originalSecret;
  });

  it('builds top converting use case and business type breakdowns', async () => {
    const venueToken = createCalendlyTrackingToken({
      leadId: '11111111-1111-4111-8111-111111111111',
      reportId: '22222222-2222-4222-8222-222222222222',
      overallScore: 70,
      priorityBand: 'HIGH',
      recommendedUseCase: 'Venue Settlement',
    });
    const eventToken = createCalendlyTrackingToken({
      leadId: '33333333-3333-4333-8333-333333333333',
      reportId: '44444444-4444-4444-8444-444444444444',
      overallScore: 80,
      priorityBand: 'IDEAL_ICP',
      recommendedUseCase: 'Event Revenue Sharing',
    });

    (prisma.agreement_analyzer_demo_bookings.findMany as jest.Mock).mockResolvedValue([
      {
        tracking_token: venueToken,
        lead: { business_type: 'Hospitality' },
      },
      {
        tracking_token: venueToken,
        lead: { business_type: 'Hospitality' },
      },
      {
        tracking_token: eventToken,
        lead: { business_type: 'Professional Services' },
      },
    ]);

    const analytics = await getAgreementAnalyzerAttributionAnalytics();

    expect(analytics.topConvertingUseCases).toEqual([
      { label: 'Venue Settlement', count: 2, percentage: 66.7 },
      { label: 'Event Revenue Sharing', count: 1, percentage: 33.3 },
    ]);
    expect(analytics.topConvertingBusinessTypes[0]).toEqual({
      label: 'Hospitality',
      count: 2,
      percentage: 66.7,
    });
    expect(analytics.topConvertingPriorityBands).toEqual([
      { label: 'HIGH', count: 2, percentage: 66.7 },
      { label: 'IDEAL_ICP', count: 1, percentage: 33.3 },
    ]);
  });
});
