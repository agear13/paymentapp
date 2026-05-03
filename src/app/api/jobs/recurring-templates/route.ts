/**
 * POST /api/jobs/recurring-templates — run recurring invoice template scheduler
 * Recommended: every 5 minutes via cron (X-Cron-Secret).
 */

import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';
import { executeJob } from '@/lib/jobs/job-scheduler';
import { runRecurringTemplatesJob } from '@/lib/recurring-templates/process-due-templates';

export async function POST(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
    }

    if (cronSecret !== expectedSecret) {
      loggers.jobs.warn(
        { ip: request.headers.get('x-forwarded-for') },
        'Unauthorized recurring-templates cron attempt'
      );
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const execution = await executeJob(
      {
        name: 'recurring-templates',
        description: 'Create payment links from due recurring invoice templates',
        schedule: '*/5 * * * *',
        enabled: true,
      },
      async () => {
        const started = Date.now();
        const result = await runRecurringTemplatesJob();
        return {
          success: result.errors.length === 0,
          data: {
            generated: result.generated,
            iterations: result.iterations,
            errorCount: result.errors.length,
            errors: result.errors,
          },
          duration: Date.now() - started,
        };
      }
    );

    loggers.jobs.info(
      {
        jobName: execution.jobName,
        success: execution.success,
        duration: execution.duration,
      },
      'Recurring templates job API completed'
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
    loggers.jobs.error({ error: message }, 'Recurring templates job API failed');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
