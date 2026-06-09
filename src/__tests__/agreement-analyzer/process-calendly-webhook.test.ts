import { createCalendlyTrackingToken } from '@/lib/agreement-analyzer/calendly/calendly-attribution.server';
import {
  extractCalendlyEventId,
  extractTrackingTokenFromCalendlyPayload,
  processCalendlyInviteeCreated,
} from '@/lib/agreement-analyzer/calendly/process-calendly-webhook.server';
import { prisma } from '@/lib/server/prisma';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    agreement_analyzer_demo_bookings: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    obligation_report_leads: {
      updateMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server', () => ({
  trackAgreementAnalyzerEvent: jest.fn(),
}));

jest.mock('@/lib/agreement-analyzer/attribution/lead-attribution.server', () => ({
  getLeadAttributionAnalyticsProperties: jest.fn().mockResolvedValue({
    utm_source: 'linkedin',
    utm_campaign: 'agreement-analyzer-launch',
  }),
}));

const LEAD_ID = '11111111-1111-4111-8111-111111111111';
const REPORT_ID = '22222222-2222-4222-8222-222222222222';

describe('process Calendly invitee.created webhook', () => {
  const originalSecret = process.env.AGREEMENT_ANALYZER_TRACKING_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AGREEMENT_ANALYZER_TRACKING_SECRET = 'test-calendly-tracking-secret-value-32chars';
  });

  afterAll(() => {
    process.env.AGREEMENT_ANALYZER_TRACKING_SECRET = originalSecret;
  });

  it('extracts signed tracking tokens from Calendly tracking metadata', () => {
    const token = createCalendlyTrackingToken({
      leadId: LEAD_ID,
      reportId: REPORT_ID,
      overallScore: 75,
      priorityBand: 'HIGH',
      recommendedUseCase: 'Venue Settlement',
    });

    expect(
      extractTrackingTokenFromCalendlyPayload({
        tracking: { utm_content: token },
      })
    ).toBe(token);
  });

  it('creates demo bookings, updates lifecycle, and emits analytics', async () => {
    const token = createCalendlyTrackingToken({
      leadId: LEAD_ID,
      reportId: REPORT_ID,
      overallScore: 75,
      priorityBand: 'HIGH',
      recommendedUseCase: 'Venue Settlement',
    });

    (prisma.agreement_analyzer_demo_bookings.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.agreement_analyzer_demo_bookings.create as jest.Mock).mockResolvedValue({
      id: 'booking-1',
    });
    (prisma.obligation_report_leads.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const result = await processCalendlyInviteeCreated({
      uri: 'https://api.calendly.com/scheduled_events/EVT123/invitees/INV456',
      email: 'alex@example.com',
      name: 'Alex Rivera',
      scheduled_event: {
        start_time: '2026-06-15T10:00:00.000Z',
      },
      tracking: {
        utm_content: token,
      },
    });

    expect(result).toEqual({ processed: true });
    expect(prisma.agreement_analyzer_demo_bookings.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        lead_id: LEAD_ID,
        report_id: REPORT_ID,
        calendly_event_id: extractCalendlyEventId({
          uri: 'https://api.calendly.com/scheduled_events/EVT123/invitees/INV456',
        }),
        invitee_name: 'Alex Rivera',
        invitee_email: 'alex@example.com',
        booking_source: 'calendly_webhook',
        tracking_token: token,
      }),
    });
    expect(prisma.obligation_report_leads.updateMany).toHaveBeenCalledWith({
      where: {
        id: LEAD_ID,
        lifecycle_stage: { in: ['REPORT_GENERATED', 'REPORT_VIEWED', 'QUALIFIED'] },
      },
      data: { lifecycle_stage: 'DEMO_BOOKED' },
    });
  });

  it('prevents duplicate bookings for the same calendly event id', async () => {
    (prisma.agreement_analyzer_demo_bookings.findUnique as jest.Mock).mockResolvedValue({
      id: 'booking-existing',
    });

    const token = createCalendlyTrackingToken({
      leadId: LEAD_ID,
      reportId: REPORT_ID,
      overallScore: 75,
      priorityBand: 'HIGH',
      recommendedUseCase: 'Venue Settlement',
    });

    const result = await processCalendlyInviteeCreated({
      uri: 'https://api.calendly.com/scheduled_events/EVT123/invitees/INV456',
      email: 'alex@example.com',
      name: 'Alex Rivera',
      scheduled_event: { start_time: '2026-06-15T10:00:00.000Z' },
      tracking: { utm_content: token },
    });

    expect(result).toEqual({ processed: true, duplicate: true });
    expect(prisma.agreement_analyzer_demo_bookings.create).not.toHaveBeenCalled();
  });

  it('rejects payloads without a valid signed tracking token', async () => {
    const result = await processCalendlyInviteeCreated({
      uri: 'https://api.calendly.com/scheduled_events/EVT123/invitees/INV456',
      email: 'alex@example.com',
      name: 'Alex Rivera',
      scheduled_event: { start_time: '2026-06-15T10:00:00.000Z' },
      tracking: { utm_content: 'abc.def' },
    });

    expect(result).toEqual({ processed: false, reason: 'invalid_tracking_token' });
  });
});
