import 'server-only';

import { trackAgreementAnalyzerEvent } from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server';
import { loggers } from '@/lib/logger';
import { prisma } from '@/lib/server/prisma';

/** Ticket 9B.1 — stale PENDING jobs older than this are considered backlog. */
export const AGREEMENT_QUEUE_BACKLOG_AGE_MS = 5 * 60 * 1000;

export type AgreementQueueBacklogSnapshot = {
  pendingCount: number;
  oldestJobAgeMs: number;
};

export async function detectAgreementQueueBacklog(
  now = Date.now()
): Promise<AgreementQueueBacklogSnapshot | null> {
  const cutoff = new Date(now - AGREEMENT_QUEUE_BACKLOG_AGE_MS);

  const staleJobs = await prisma.agreement_processing_jobs.findMany({
    where: {
      status: 'PENDING',
      created_at: { lt: cutoff },
    },
    orderBy: { created_at: 'asc' },
    select: { created_at: true },
  });

  if (staleJobs.length === 0) {
    return null;
  }

  const oldestCreatedAt = staleJobs[0].created_at;

  return {
    pendingCount: staleJobs.length,
    oldestJobAgeMs: now - oldestCreatedAt.getTime(),
  };
}

export async function monitorAgreementQueueBacklog(): Promise<AgreementQueueBacklogSnapshot | null> {
  const backlog = await detectAgreementQueueBacklog();

  if (!backlog) {
    return null;
  }

  const oldestJobAgeMinutes = Math.round(backlog.oldestJobAgeMs / 60_000);

  loggers.api.warn('Agreement processing queue backlog detected', {
    pendingCount: backlog.pendingCount,
    oldestJobAgeMs: backlog.oldestJobAgeMs,
    oldestJobAgeMinutes,
  });

  trackAgreementAnalyzerEvent('agreement_queue_backlog_detected', {
    pendingCount: backlog.pendingCount,
    oldestJobAgeMs: backlog.oldestJobAgeMs,
    oldestJobAgeMinutes,
  });

  return backlog;
}
