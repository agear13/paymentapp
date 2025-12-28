/**
 * Stuck Payments Job API
 * POST /api/jobs/stuck-payments - Check for stuck payment links
 * 
 * This endpoint should be called by a cron job or scheduled task
 * Recommended schedule: Every 15 minutes
 */

import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';
import { checkStuckPaymentLinks } from '@/lib/jobs/expired-links-job';
import { executeJob } from '@/lib/jobs/job-scheduler';

/**
 * POST /api/jobs/stuck-payments
 * Check for stuck payment links and log alerts
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
        name: 'stuck-payments',
        description: 'Check for payment links stuck in OPEN state',
        schedule: '*/15 * * * *', // Every 15 minutes
        enabled: true,
      },
      async () => {
        const startTime = Date.now();
        const result = await checkStuckPaymentLinks();
        const duration = Date.now() - startTime;

        // Log alerts for stuck payments
        if (result.count > 0) {
          loggers.jobs.warn(
            {
              count: result.count,
              stuckLinks: result.stuckLinks,
            },
            'Found stuck payment links requiring attention'
          );
        }

        return {
          success: true,
          data: {
            stuckCount: result.count,
            stuckLinks: result.stuckLinks,
          },
          duration,
        };
      }
    );

    loggers.jobs.info(
      {
        jobName: execution.jobName,
        success: execution.success,
        duration: execution.duration,
      },
      'Stuck payments job API completed'
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
      'Stuck payments job API failed'
    );

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/jobs/stuck-payments
 * Get job status and recent execution history
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { getJobHistory, getJobStats } = await import('@/lib/jobs/job-scheduler');
    
    const history = getJobHistory('stuck-payments', 10);
    const stats = getJobStats('stuck-payments');

    return NextResponse.json({
      jobName: 'stuck-payments',
      stats,
      recentExecutions: history,
    });
  } catch (error: any) {
    loggers.jobs.error(
      { error: error.message },
      'Failed to get stuck payments job status'
    );

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}






