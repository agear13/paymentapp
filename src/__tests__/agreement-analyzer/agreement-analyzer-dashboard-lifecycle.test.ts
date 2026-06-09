import {
  markLeadCustomer,
  markLeadQualified,
  updateAgreementAnalyzerLeadLifecycle,
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
  getLeadAttributionAnalyticsProperties: jest.fn().mockResolvedValue({}),
}));

describe('agreement analyzer dashboard lifecycle actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marks leads qualified from active funnel stages', async () => {
    (prisma.obligation_report_leads.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const transitioned = await markLeadQualified('lead-1');

    expect(transitioned).toBe(true);
    expect(prisma.obligation_report_leads.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'lead-1',
        lifecycle_stage: { in: ['REPORT_GENERATED', 'REPORT_VIEWED', 'DEMO_BOOKED'] },
      },
      data: { lifecycle_stage: 'QUALIFIED' },
    });
  });

  it('marks leads as customers from qualified or demo booked stages', async () => {
    (prisma.obligation_report_leads.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const transitioned = await markLeadCustomer('lead-1');

    expect(transitioned).toBe(true);
    expect(prisma.obligation_report_leads.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'lead-1',
        lifecycle_stage: { in: ['QUALIFIED', 'DEMO_BOOKED'] },
      },
      data: { lifecycle_stage: 'CUSTOMER' },
    });
  });

  it('routes dashboard lifecycle actions through the shared updater', async () => {
    (prisma.obligation_report_leads.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await updateAgreementAnalyzerLeadLifecycle('lead-1', 'DEMO_BOOKED');

    expect(prisma.obligation_report_leads.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'lead-1',
        lifecycle_stage: { in: ['REPORT_GENERATED', 'REPORT_VIEWED', 'QUALIFIED'] },
      },
      data: { lifecycle_stage: 'DEMO_BOOKED' },
    });
  });
});
