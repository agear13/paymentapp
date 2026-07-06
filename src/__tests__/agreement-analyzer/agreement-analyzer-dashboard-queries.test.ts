import {
  buildLeadDetailActivityFixtures,
  fixtureDateRelativeToNow,
} from '@/__tests__/agreement-analyzer/analytics-window-fixtures';
import { getAgreementAnalyzerLeadDetail } from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-queries.server';
import { prisma } from '@/lib/server/prisma';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    obligation_report_leads: {
      findUnique: jest.fn(),
    },
    agreement_processing_jobs: {
      findFirst: jest.fn(),
    },
    agreement_analyzer_demo_bookings: {
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

jest.mock('@/lib/agreement-analyzer/demo-bookings/demo-bookings.server', () => ({
  countDemoBookings: jest.fn().mockResolvedValue(3),
}));

describe('agreement analyzer dashboard queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads lead detail with qualification, report insights, and activity timeline', async () => {
    const fixtures = buildLeadDetailActivityFixtures();

    (prisma.obligation_report_leads.findUnique as jest.Mock).mockResolvedValue({
      id: 'lead-1',
      first_name: 'Alex',
      last_name: 'Rivera',
      email: 'alex@example.com',
      company_name: 'Harbour Events',
      business_type: 'Hospitality',
      lifecycle_stage: 'REPORT_VIEWED',
      created_at: fixtures.leadCreatedAt,
      updated_at: fixtures.leadUpdatedAt,
      obligation_report_lead_scores: [
        {
          overall_score: 75,
          priority_band: 'HIGH',
          recommended_use_case: 'Event Revenue Sharing',
          complexity_score: 42,
          revenue_share_detected: true,
          hospitality_detected: true,
          event_detected: true,
          accountant_detected: false,
          multi_party_detected: false,
          party_count: 2,
        },
      ],
      agreement_uploads: [
        {
          uploaded_at: fixtures.uploadedAt,
          created_at: fixtures.uploadCreatedAt,
          agreement_obligation_reports: [
            {
              created_at: fixtures.reportCreatedAt,
              viewed_at: fixtures.viewedAt,
              settlement_readiness_score: 78,
              report_json: {
                parties: [{ name: 'Promoter' }],
                revenueSplits: [{ beneficiary: 'Venue', percentage: 30 }],
                paymentConditions: [{ description: 'Settlement within 3 days' }],
                obligations: [{ obligation: 'Provide ticket sales report' }],
                risks: [{ description: 'Late settlement risk' }],
                missingInformation: [{ field: 'GST treatment' }],
                settlementReadiness: {
                  score: 78,
                  summary: 'Mostly ready',
                  factors: ['Clear split terms'],
                },
              },
            },
          ],
        },
      ],
      obligation_report_email_events: [
        {
          delivered_at: fixtures.deliveredAt,
          opened_at: fixtures.openedAt,
          clicked_at: null,
        },
      ],
      agreement_analyzer_demo_bookings: [
        {
          id: 'booking-1',
          calendly_event_id: 'scheduled_events/EVT/invitees/INV',
          meeting_time: fixtures.meetingTime,
          invitee_name: 'Alex Rivera',
          invitee_email: 'alex@example.com',
          booking_source: 'calendly_webhook',
          created_at: fixtures.demoBookingCreatedAt,
        },
      ],
    });
    (prisma.agreement_processing_jobs.findFirst as jest.Mock).mockResolvedValue({
      status: 'COMPLETED',
      attempt_count: 0,
      last_error: null,
      report: { status: 'COMPLETED' },
    });

    const detail = await getAgreementAnalyzerLeadDetail('lead-1');

    expect(detail).toMatchObject({
      id: 'lead-1',
      firstName: 'Alex',
      lastName: 'Rivera',
      score: {
        overallScore: 75,
        priorityBand: 'HIGH',
        recommendedUseCase: 'Event Revenue Sharing',
        revenueShareDetected: true,
      },
      report: {
        parties: [{ name: 'Promoter' }],
        revenueSplits: [{ beneficiary: 'Venue', percentage: 30 }],
      },
      processing: {
        extractionStatus: 'COMPLETED',
        jobStatus: 'COMPLETED',
        processingAttempts: 0,
        lastError: null,
      },
    });

    expect(detail?.activity.map((event) => event.type)).toEqual([
      'UPLOADED',
      'REPORT_GENERATED',
      'EMAIL_SENT',
      'EMAIL_OPENED',
      'REPORT_VIEWED',
      'DEMO_BOOKED',
    ]);
    expect(detail?.demoBookings.past).toHaveLength(1);
  });

  it('lists leads using aggregated query results', async () => {
    const { listAgreementAnalyzerLeads } = await import(
      '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-queries.server'
    );

    (prisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'lead-1',
          created_at: fixtureDateRelativeToNow(-5, 10),
          first_name: 'Alex',
          last_name: 'Rivera',
          email: 'alex@example.com',
          company_name: 'Harbour Events',
          business_type: 'Hospitality',
          lifecycle_stage: 'REPORT_VIEWED',
          overall_score: 75,
          priority_band: 'HIGH',
          recommended_use_case: 'Event Revenue Sharing',
          report_viewed: true,
          demo_clicked: false,
        },
      ])
      .mockResolvedValueOnce([{ count: 1n }]);

    const result = await listAgreementAnalyzerLeads({
      scoreRange: '70-89',
      priorityBand: 'HIGH',
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      email: 'alex@example.com',
      overallScore: 75,
      priorityBand: 'HIGH',
      reportViewed: true,
    });
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });
});
