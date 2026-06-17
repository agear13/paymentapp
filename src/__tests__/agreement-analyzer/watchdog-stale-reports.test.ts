import { trackAgreementAnalyzerEvent } from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server';
import {
  AGREEMENT_REPORT_WATCHDOG_AGE_MS,
  AGREEMENT_REPORT_WATCHDOG_REASON,
  failStalePendingAgreementReports,
} from '@/lib/agreement-analyzer/jobs/watchdog-stale-reports.server';
import { prisma } from '@/lib/server/prisma';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    agreement_obligation_reports: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    agreement_ai_extractions: {
      create: jest.fn(),
    },
    agreement_uploads: {
      update: jest.fn(),
    },
    agreement_processing_jobs: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server', () => ({
  trackAgreementAnalyzerEvent: jest.fn(),
}));

describe('agreement report watchdog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns zero when no stale pending reports exist', async () => {
    (prisma.agreement_obligation_reports.findMany as jest.Mock).mockResolvedValue([]);

    const result = await failStalePendingAgreementReports(Date.parse('2026-06-09T12:10:00.000Z'));

    expect(result).toEqual({ failedReportIds: [], failedCount: 0 });
    expect(prisma.agreement_obligation_reports.findMany).toHaveBeenCalledWith({
      where: {
        status: 'PENDING',
        created_at: {
          lt: new Date(Date.parse('2026-06-09T12:10:00.000Z') - AGREEMENT_REPORT_WATCHDOG_AGE_MS),
        },
      },
      orderBy: { created_at: 'asc' },
      select: expect.any(Object),
    });
  });

  it('marks stale pending reports and jobs as failed with a diagnostic reason', async () => {
    const now = Date.parse('2026-06-09T12:10:00.000Z');
    (prisma.agreement_obligation_reports.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'report-1',
        upload_id: 'upload-1',
        created_at: new Date(now - 3 * 60_000),
        agreement_processing_jobs: [{ id: 'job-1', status: 'PENDING' }],
      },
    ]);

    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma));
    (prisma.agreement_ai_extractions.create as jest.Mock).mockResolvedValue({ id: 'extraction-1' });
    (prisma.agreement_obligation_reports.update as jest.Mock).mockResolvedValue({});
    (prisma.agreement_uploads.update as jest.Mock).mockResolvedValue({});
    (prisma.agreement_processing_jobs.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const result = await failStalePendingAgreementReports(now);

    expect(result.failedCount).toBe(1);
    expect(result.failedReportIds).toEqual(['report-1']);
    expect(prisma.agreement_obligation_reports.update).toHaveBeenCalledWith({
      where: { id: 'report-1' },
      data: { status: 'FAILED' },
    });
    expect(prisma.agreement_processing_jobs.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['job-1'] } },
      data: expect.objectContaining({
        status: 'FAILED',
        last_error: AGREEMENT_REPORT_WATCHDOG_REASON,
      }),
    });
    expect(trackAgreementAnalyzerEvent).toHaveBeenCalledWith(
      'agreement_job_failed',
      expect.objectContaining({
        reportId: 'report-1',
        uploadId: 'upload-1',
        stage: 'watchdog',
      })
    );
  });
});
