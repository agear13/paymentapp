/**
 * Xero Queue Manual Trigger (ops / automation)
 * Requires either CRON_SECRET (same as /api/xero/queue/process) or global admin (ADMIN_EMAILS).
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth/admin.server';
import { processQueue } from '@/lib/xero/queue-processor';
import { logger } from '@/lib/logger';

function isAuthorizedCron(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${cronSecret}`;
}

/**
 * POST /api/xero/queue/process-now
 *
 * Authorization: `Authorization: Bearer <CRON_SECRET>` (automation) or global admin session (ADMIN_EMAILS).
 */
export async function POST(request: NextRequest) {
  try {
    if (isAuthorizedCron(request)) {
      logger.info({}, 'Manual queue processing triggered via CRON_SECRET');
    } else {
      const adminAuth = await checkAdminAuth();
      if (!adminAuth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (!adminAuth.isAdmin) {
        return NextResponse.json(
          { error: 'Forbidden — admin or cron token required' },
          { status: 403 }
        );
      }
      logger.info({ userId: adminAuth.user.id }, 'Manual queue processing triggered by admin');
    }

    // Get batch size from query params
    const { searchParams } = new URL(request.url);
    const batchSize = parseInt(searchParams.get('batchSize') || '20', 10);

    // 🚀 Process queue in background to avoid Render's 30-second HTTP timeout
    // This prevents 502 errors and allows long-running sync operations to complete
    processQueue(batchSize)
      .then((stats) => {
        logger.info(
          {
            processed: stats.processed,
            succeeded: stats.succeeded,
            failed: stats.failed,
            skipped: stats.skipped,
          },
          'Background queue processing complete'
        );
      })
      .catch((error) => {
        logger.error({ error: error.message }, 'Background queue processing failed');
      });

    // Return immediately to avoid timeout
    return NextResponse.json({
      success: true,
      message: 'Queue processing started in background',
      note: 'Use GET /api/xero/queue/process-now to check progress',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, 'Error processing queue manually');

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/xero/queue/process-now
 * 
 * Get queue status
 */
export async function GET(request: NextRequest) {
  try {
    if (!isAuthorizedCron(request)) {
      const adminAuth = await checkAdminAuth();
      if (!adminAuth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (!adminAuth.isAdmin) {
        return NextResponse.json(
          { error: 'Forbidden — admin or cron token required' },
          { status: 403 }
        );
      }
    }

    // Get pending sync count
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

    return NextResponse.json({
      pendingCount,
      recentSyncs,
      message: 'POST to /api/xero/queue/process-now to process pending syncs',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

