/**
 * Expired Links Job API
 * POST /api/jobs/expired-links - Run expired links background job
 * 
 * This endpoint should be called by a cron job or scheduled task
 * Recommended schedule: Every 5 minutes
 */

import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';
import { runExpiredLinksJob } from '@/lib/jobs/expired-links-job';
import { executeJob } from '@/lib/jobs/job-scheduler';

/**
 * POST /api/jobs/expired-links
 * Run the expired links background job
 * 
 * Should be secured with:
 * 1. Cron secret header (X-Cron-Secret)
 * 2. IP whitelist (Vercel Cron IPs)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret) {
      loggers.jobs.warn(
        { ip: request.headers.get('x-forwarded-for') },
        'Unauthorized cron job attempt'
      );
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Execute job with scheduler
    const execution = await executeJob(
      {
        name: 'expired-links',
        description: 'Transition expired payment links to EXPIRED status',
        schedule: '*/5 * * * *', // Every 5 minutes
        enabled: true,
      },
      async () => {
        const result = await runExpiredLinksJob();
        return {
          success: result.success,
          data: {
            processedCount: result.processedCount,
            expiredCount: result.expiredCount,
            errorCount: result.errors.length,
          },
          duration: result.duration,
        };
      }
    );

    loggers.jobs.info(
      {
        jobName: execution.jobName,
        success: execution.success,
        duration: execution.duration,
      },
      'Expired links job API completed'
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
  } catch (error: any) {
    loggers.jobs.error(
      { error: error.message },
      'Expired links job API failed'
    );

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/jobs/expired-links
 * Get job status and recent execution history
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for status endpoint too
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { getJobHistory, getJobStats } = await import('@/lib/jobs/job-scheduler');
    
    const history = getJobHistory('expired-links', 10);
    const stats = getJobStats('expired-links');

    return NextResponse.json({
      jobName: 'expired-links',
      stats,
      recentExecutions: history,
    });
  } catch (error: any) {
    loggers.jobs.error(
      { error: error.message },
      'Failed to get expired links job status'
    );

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}






