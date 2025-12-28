/**
 * Xero Queue Processing API Endpoint
 * Processes pending sync jobs - designed to be called by a cron job
 * 
 * Sprint 13: Queue & Retry Logic
 */

import { NextRequest, NextResponse } from 'next/server';
import { processQueue } from '@/lib/xero/queue-processor';
import { logger } from '@/lib/logger';

/**
 * POST /api/xero/queue/process
 * 
 * Process pending Xero sync jobs from the queue
 * This endpoint should be called periodically (e.g., every minute) via cron
 * 
 * Headers:
 * - Authorization: Bearer <CRON_SECRET> (for security)
 * 
 * Query params:
 * - batchSize: number of jobs to process (default: 10)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('Unauthorized queue process attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get batch size from query params
    const { searchParams } = new URL(request.url);
    const batchSize = parseInt(searchParams.get('batchSize') || '10', 10);

    if (batchSize < 1 || batchSize > 100) {
      return NextResponse.json(
        { error: 'batchSize must be between 1 and 100' },
        { status: 400 }
      );
    }

    logger.info({ batchSize }, 'Starting queue processing via API');

    // Process the queue
    const stats = await processQueue(batchSize);

    logger.info(
      {
        processed: stats.processed,
        succeeded: stats.succeeded,
        failed: stats.failed,
        skipped: stats.skipped,
      },
      'Queue processing complete'
    );

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, 'Error processing queue');

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
 * GET /api/xero/queue/process
 * 
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Xero queue processor endpoint',
    usage: 'POST with Authorization: Bearer <CRON_SECRET>',
  });
}







