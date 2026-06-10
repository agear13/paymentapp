import { trackAgreementAnalyzerEvent } from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server';
import {
  AGREEMENT_QUEUE_BACKLOG_AGE_MS,
  detectAgreementQueueBacklog,
  monitorAgreementQueueBacklog,
} from '@/lib/agreement-analyzer/jobs/monitor-queue-backlog.server';
import { prisma } from '@/lib/server/prisma';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    agreement_processing_jobs: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server', () => ({
  trackAgreementAnalyzerEvent: jest.fn(),
}));

describe('agreement queue backlog monitoring (Ticket 9B.1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when no stale pending jobs exist', async () => {
    (prisma.agreement_processing_jobs.findMany as jest.Mock).mockResolvedValue([]);

    const backlog = await detectAgreementQueueBacklog(Date.parse('2026-06-09T12:10:00.000Z'));

    expect(backlog).toBeNull();
    expect(prisma.agreement_processing_jobs.findMany).toHaveBeenCalledWith({
      where: {
        status: 'PENDING',
        created_at: {
          lt: new Date(Date.parse('2026-06-09T12:10:00.000Z') - AGREEMENT_QUEUE_BACKLOG_AGE_MS),
        },
      },
      orderBy: { created_at: 'asc' },
      select: { created_at: true },
    });
  });

  it('detects stale pending jobs and emits backlog analytics', async () => {
    const now = Date.parse('2026-06-09T12:10:00.000Z');
    jest.spyOn(Date, 'now').mockReturnValue(now);
    (prisma.agreement_processing_jobs.findMany as jest.Mock).mockResolvedValue([
      { created_at: new Date(now - 8 * 60_000) },
      { created_at: new Date(now - 6 * 60_000) },
    ]);

    const backlog = await monitorAgreementQueueBacklog();

    expect(backlog).toEqual({
      pendingCount: 2,
      oldestJobAgeMs: 8 * 60_000,
    });
    expect(trackAgreementAnalyzerEvent).toHaveBeenCalledWith('agreement_queue_backlog_detected', {
      pendingCount: 2,
      oldestJobAgeMs: 8 * 60_000,
      oldestJobAgeMinutes: 8,
    });
  });
});
