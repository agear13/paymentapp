/**
 * Xero Queue Manual Trigger (ops / automation)
 * Requires either CRON_SECRET (same as /api/xero/queue/process) or global admin (ADMIN_EMAIL_ALLOWLIST).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth/api-session.server';
import { processQueue } from '@/lib/xero/queue-processor';
import { loggers } from '@/lib/logger';
import {
  assertXeroConfigured,
  XeroConfigurationError,
} from '@/lib/xero/xero-config';

function isAuthorizedCron(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${cronSecret}`;
}

function configurationResponse(error: XeroConfigurationError) {
  return NextResponse.json(
    {
      success: false,
      error: error.message,
      code: 'XERO_NOT_CONFIGURED',
      missingEnv: error.missing,
    },
    { status: 503 }
  );
}

function internalErrorResponse(error: unknown, step: string) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  loggers.xero.error('xero_process_now_failed', error, { step });
  return NextResponse.json(
    {
      success: false,
      error: message,
      step,
      code: 'XERO_PROCESS_NOW_FAILED',
    },
    { status: 500 }
  );
}

/**
 * POST /api/xero/queue/process-now
 */
export async function POST(request: NextRequest) {
  const step = 'post_handler';
  try {
    loggers.xero.info('xero_process_now_post_start', { step: 'authorize_request' });

    if (isAuthorizedCron(request)) {
      loggers.xero.info('xero_process_now_authorized', { step: 'cron_secret' });
    } else {
      const adminAuth = await requireAdminForApi(request);
      if (!adminAuth.user) {
        loggers.xero.warn('xero_process_now_unauthorized', { step: 'admin_auth' });
        return adminAuth.response!;
      }
      loggers.xero.info('xero_process_now_authorized', {
        step: 'admin_session',
        userId: adminAuth.user.id,
      });
    }

    loggers.xero.info('xero_process_now_check_config', { step: 'check_environment' });
    try {
      assertXeroConfigured();
    } catch (error) {
      if (error instanceof XeroConfigurationError) {
        loggers.xero.error('xero_process_now_config_missing', error, { step: 'check_environment' });
        return configurationResponse(error);
      }
      throw error;
    }

    const { searchParams } = new URL(request.url);
    const batchSize = parseInt(searchParams.get('batchSize') || '20', 10);

    loggers.xero.info('xero_process_now_queue_start', {
      step: 'start_background_processing',
      batchSize,
    });

    processQueue(batchSize)
      .then((stats) => {
        loggers.xero.info('xero_process_now_queue_complete', {
          step: 'background_processing_complete',
          processed: stats.processed,
          succeeded: stats.succeeded,
          failed: stats.failed,
          skipped: stats.skipped,
          errors: stats.errors,
        });
      })
      .catch((error) => {
        loggers.xero.error('xero_process_now_queue_failed', error, {
          step: 'background_processing',
        });
      });

    return NextResponse.json({
      success: true,
      message: 'Queue processing started in background',
      note: 'Use GET /api/xero/queue/process-now to check progress',
    });
  } catch (error) {
    if (error instanceof XeroConfigurationError) {
      return configurationResponse(error);
    }
    return internalErrorResponse(error, step);
  }
}

/**
 * GET /api/xero/queue/process-now — queue status
 */
export async function GET(request: NextRequest) {
  const step = 'get_handler';
  try {
    loggers.xero.info('xero_process_now_get_start', { step: 'authorize_request' });

    if (!isAuthorizedCron(request)) {
      const adminAuth = await requireAdminForApi(request);
      if (!adminAuth.user) {
        loggers.xero.warn('xero_process_now_get_unauthorized', { step: 'admin_auth' });
        return adminAuth.response!;
      }
      loggers.xero.info('xero_process_now_get_authorized', {
        step: 'admin_session',
        userId: adminAuth.user.id,
      });
    } else {
      loggers.xero.info('xero_process_now_get_authorized', { step: 'cron_secret' });
    }

    loggers.xero.info('xero_process_now_get_check_config', { step: 'check_environment' });
    try {
      assertXeroConfigured();
    } catch (error) {
      if (error instanceof XeroConfigurationError) {
        return configurationResponse(error);
      }
      throw error;
    }

    loggers.xero.info('xero_process_now_get_query', { step: 'load_queue_status' });
    const { prisma } = await import('@/lib/server/prisma');

    const pendingCount = await prisma.xero_syncs.count({
      where: {
        status: { in: ['PENDING', 'RETRYING'] },
        next_retry_at: { lte: new Date() },
      },
    });

    const recentSyncs = await prisma.xero_syncs.findMany({
      where: { status: { in: ['PENDING', 'RETRYING', 'SUCCESS', 'FAILED'] } },
      orderBy: { created_at: 'desc' },
      take: 10,
      select: {
        id: true,
        payment_link_id: true,
        status: true,
        retry_count: true,
        error_message: true,
        created_at: true,
        updated_at: true,
      },
    });

    loggers.xero.info('xero_process_now_get_success', {
      step: 'load_queue_status',
      pendingCount,
    });

    return NextResponse.json({
      pendingCount,
      recentSyncs,
      message: 'POST to /api/xero/queue/process-now to process pending syncs',
    });
  } catch (error) {
    if (error instanceof XeroConfigurationError) {
      return configurationResponse(error);
    }
    return internalErrorResponse(error, step);
  }
}
