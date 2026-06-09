import {
  markLeadCustomer,
  markLeadDemoBooked,
  transitionLeadLifecycleStage,
} from '@/lib/agreement-analyzer/lead-lifecycle.server';
import { prisma } from '@/lib/server/prisma';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    obligation_report_leads: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
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

describe('agreement analyzer lead lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('transitions lead lifecycle when current stage matches', async () => {
    (prisma.obligation_report_leads.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const transitioned = await transitionLeadLifecycleStage({
      leadId: 'lead-1',
      fromStages: ['NEW', 'REPORT_GENERATED'],
      toStage: 'REPORT_VIEWED',
    });

    expect(transitioned).toBe(true);
    expect(prisma.obligation_report_leads.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'lead-1',
        lifecycle_stage: { in: ['NEW', 'REPORT_GENERATED'] },
      },
      data: { lifecycle_stage: 'REPORT_VIEWED' },
    });
  });

  it('emits customer analytics with lead attribution when lifecycle becomes CUSTOMER', async () => {
    const { trackAgreementAnalyzerEvent } = await import(
      '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server'
    );

    (prisma.obligation_report_leads.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const transitioned = await markLeadCustomer('lead-1');

    expect(transitioned).toBe(true);
    expect(trackAgreementAnalyzerEvent).toHaveBeenCalledWith('agreement_analyzer_customer', {
      leadId: 'lead-1',
      utm_source: 'linkedin',
      utm_campaign: 'agreement-analyzer-launch',
    });
  });

  it('supports demo booked placeholder transition', async () => {
    (prisma.obligation_report_leads.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const transitioned = await markLeadDemoBooked('lead-1', 'report_page_footer');

    expect(transitioned).toBe(true);
    expect(prisma.obligation_report_leads.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'lead-1',
        lifecycle_stage: { in: ['REPORT_GENERATED', 'REPORT_VIEWED', 'QUALIFIED'] },
      },
      data: { lifecycle_stage: 'DEMO_BOOKED' },
    });
  });
});
