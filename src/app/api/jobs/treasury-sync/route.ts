/**
 * POST /api/jobs/treasury-sync — poll Digital Surge and ingest treasury events
 * Auth: X-Cron-Secret: CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';
import { executeLeasedJob } from '@/lib/jobs/job-scheduler';
import { runTreasurySyncJob } from '@/lib/jobs/treasury-sync';

export async function POST(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
    }

    if (cronSecret !== expectedSecret) {
      loggers.jobs.warn('Unauthorized treasury-sync cron attempt', {
        ip: request.headers.get('x-forwarded-for'),
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const execution = await executeLeasedJob(
      {
        name: 'treasury-sync',
        description: 'Poll Digital Surge read-only APIs and ingest treasury lifecycle events',
        schedule: '*/15 * * * *',
        enabled: true,
      },
      async () => {
        const started = Date.now();
        const result = await runTreasurySyncJob();
        return {
          success: result.success,
          message: result.message,
          data: result.data,
          duration: Date.now() - started,
        };
      },
      {
        enabled: true,
        leaseTtlSeconds: Number.parseInt(process.env.TREASURY_SYNC_LEASE_TTL_SECONDS || '900', 10) || 900,
      }
    );

    return NextResponse.json({
      success: execution.success,
      execution: {
        jobName: execution.jobName,
        startTime: execution.startTime,
        endTime: execution.endTime,
        duration: execution.duration,
        result: execution.result,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    loggers.jobs.error('Treasury sync job API failed', new Error(message));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
