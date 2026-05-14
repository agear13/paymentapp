/**
 * POST /api/jobs/stripe-reconciliation — replay missed Stripe successes via confirmPayment
 * Auth: X-Cron-Secret: CRON_SECRET (same as other job routes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';
import { executeLeasedJob } from '@/lib/jobs/job-scheduler';
import { runStripeReconciliationJob } from '@/lib/jobs/stripe-reconciliation';

export async function POST(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
    }

    if (cronSecret !== expectedSecret) {
      loggers.jobs.warn('Unauthorized stripe-reconciliation cron attempt', {
        ip: request.headers.get('x-forwarded-for'),
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const execution = await executeLeasedJob(
      {
        name: 'stripe-reconciliation',
        description:
          'List recent Stripe checkout.session.completed and payment_intent.succeeded events; confirmPayment when not yet reflected',
        schedule: '*/10 * * * *',
        enabled: true,
      },
      async () => {
        const started = Date.now();
        const result = await runStripeReconciliationJob();
        return {
          success: result.success,
          message: result.message,
          data: result.data,
          duration: Date.now() - started,
        };
      },
      {
        enabled: true,
        leaseTtlSeconds: Number.parseInt(process.env.STRIPE_RECON_LEASE_TTL_SECONDS || '900', 10) || 900,
      }
    );

    loggers.jobs.info('Stripe reconciliation job API completed', {
      jobName: execution.jobName,
      success: execution.success,
      duration: execution.duration,
      result: execution.result,
    });

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
    loggers.jobs.error('Stripe reconciliation job API failed', new Error(message));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
