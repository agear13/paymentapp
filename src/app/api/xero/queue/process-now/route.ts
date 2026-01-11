/**
 * Xero Queue Manual Trigger (For Testing/Admin Use)
 * Processes pending Xero syncs without requiring CRON_SECRET
 * 
 * WARNING: This endpoint should be protected or removed in production
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processQueue } from '@/lib/xero/queue-processor';
import { logger } from '@/lib/logger';

/**
 * POST /api/xero/queue/process-now
 * 
 * Manually trigger queue processing (no auth required for testing)
 * In production, you should either:
 * 1. Remove this endpoint
 * 2. Add authentication
 * 3. Use the /api/xero/queue/process endpoint with CRON_SECRET
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add simple authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - please log in' },
        { status: 401 }
      );
    }

    logger.info({ userId: user.id }, 'Manual queue processing triggered');

    // Get batch size from query params
    const { searchParams } = new URL(request.url);
    const batchSize = parseInt(searchParams.get('batchSize') || '20', 10);

    // Process the queue
    const stats = await processQueue(batchSize);

    logger.info(
      {
        userId: user.id,
        processed: stats.processed,
        succeeded: stats.succeeded,
        failed: stats.failed,
        skipped: stats.skipped,
      },
      'Manual queue processing complete'
    );

    return NextResponse.json({
      success: true,
      message: 'Queue processing completed',
      stats: {
        processed: stats.processed,
        succeeded: stats.succeeded,
        failed: stats.failed,
        skipped: stats.skipped,
      },
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
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - please log in' },
        { status: 401 }
      );
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

