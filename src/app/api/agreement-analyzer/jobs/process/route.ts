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
import { processAgreementProcessingJobsBatch } from '@/lib/agreement-analyzer/jobs/process-jobs.server';
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
    const batch = await processAgreementProcessingJobsBatch(workerId, limit);
    const backlog = await monitorAgreementQueueBacklog();

    return NextResponse.json({ success: true, batch, backlog });
  } catch (error) {
    loggers.api.error('agreement-analyzer jobs process route failed', error);
    return NextResponse.json({ error: 'Job processing failed.' }, { status: 500 });
  }
}
