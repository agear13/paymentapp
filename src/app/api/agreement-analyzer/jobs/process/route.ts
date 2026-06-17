/**
 * POST /api/agreement-analyzer/jobs/process
 * Claims and processes pending agreement extraction jobs (Vercel cron fallback).
 * Secured via CRON_SECRET.
 */

export const runtime = 'nodejs';
export const maxDuration = 120;

import { randomUUID } from 'crypto';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { monitorAgreementQueueBacklog } from '@/lib/agreement-analyzer/jobs/monitor-queue-backlog.server';
import { logAgreementJobStage } from '@/lib/agreement-analyzer/jobs/agreement-job-log.server';
import { processAgreementProcessingJobsBatch } from '@/lib/agreement-analyzer/jobs/process-jobs.server';
import { failStalePendingAgreementReports } from '@/lib/agreement-analyzer/jobs/watchdog-stale-reports.server';
import {
  cronAuthFailureResponse,
  verifyCronRequest,
} from '@/lib/jobs/cron-request-auth';
import { loggers } from '@/lib/logger';

const bodySchema = z.object({
  limit: z.number().int().min(1).max(50).optional(),
});

export async function POST(request: NextRequest) {
  const cronFailure = verifyCronRequest(request);
  if (cronFailure) {
    logAgreementJobStage('cron_invoked', {
      authFailed: true,
      reason: cronFailure.kind,
    });
    return cronAuthFailureResponse(cronFailure);
  }

  try {
    const json = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const limit = parsed.data.limit ?? 10;
    const workerId = `cron-${randomUUID()}`;

    logAgreementJobStage('cron_invoked', { workerId, limit });

    const watchdog = await failStalePendingAgreementReports();
    const batch = await processAgreementProcessingJobsBatch(workerId, limit);
    const backlog = await monitorAgreementQueueBacklog();

    if (batch.processed === 0) {
      logAgreementJobStage('cron_idle', {
        workerId,
        pendingBacklogCount: backlog?.pendingCount,
      });
    }

    return NextResponse.json({ success: true, batch, backlog, watchdog });
  } catch (error) {
    loggers.api.error('agreement-analyzer jobs process route failed', error);
    return NextResponse.json({ error: 'Job processing failed.' }, { status: 500 });
  }
}
