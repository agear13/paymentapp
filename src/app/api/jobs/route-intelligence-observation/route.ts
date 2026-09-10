/**
 * POST /api/jobs/route-intelligence-observation
 * Hourly official-provider operational-health poll (Wise Statuspage).
 * Auth: X-Cron-Secret: CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';
import { executeLeasedJob } from '@/lib/jobs/job-scheduler';
import { runRouteIntelligenceObservationJob } from '@/lib/jobs/route-intelligence-observation';

export async function POST(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
    }

    if (cronSecret !== expectedSecret) {
      loggers.jobs.warn('Unauthorized route-intelligence-observation cron attempt', {
        ip: request.headers.get('x-forwarded-for'),
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const execution = await executeLeasedJob(
      {
        name: 'route-intelligence-observation',
        description: 'Observe official Wise Payments operational health from Statuspage',
        schedule: '0 * * * *',
        enabled: true,
      },
      async () => {
        const started = Date.now();
        const result = await runRouteIntelligenceObservationJob();
        return {
          success: result.success,
          message: result.message,
          data: result.data,
          duration: Date.now() - started,
        };
      },
      {
        enabled: true,
        leaseTtlSeconds:
          Number.parseInt(process.env.ROUTE_INTEL_OBS_LEASE_TTL_SECONDS || '600', 10) || 600,
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
    loggers.jobs.error('Route intelligence observation job API failed', new Error(message));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
