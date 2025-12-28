/**
 * Manual Xero Sync Replay API
 * Allows manual replay of failed or specific sync jobs
 * 
 * Sprint 13: Manual Replay
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processSyncById } from '@/lib/xero/queue-processor';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * POST /api/xero/sync/replay
 * 
 * Manually replay a sync job
 * 
 * Body:
 * {
 *   "syncId": "uuid",
 *   "resetRetryCount"?: boolean  // Optional: reset retry count to 0
 * }
 * 
 * Query params:
 * - organization_id: required for authorization check
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get organization from query params
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organization_id');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Missing organization_id parameter' },
        { status: 400 }
      );
    }

    // TODO: Verify user has permission to access this organization

    // Parse request body
    const body = await request.json();
    const { syncId, resetRetryCount = false } = body;

    if (!syncId) {
      return NextResponse.json(
        { error: 'Missing syncId in request body' },
        { status: 400 }
      );
    }

    logger.info(
      { syncId, organizationId, resetRetryCount },
      'Manual replay requested'
    );

    // Verify sync belongs to organization
    const syncRecord = await prisma.xero_syncs.findUnique({
      where: { id: syncId },
      include: {
        payment_links: {
          select: { organization_id: true },
        },
      },
    });

    if (!syncRecord) {
      return NextResponse.json(
        { error: 'Sync record not found' },
        { status: 404 }
      );
    }

    if (syncRecord.payment_links.organization_id !== organizationId) {
      return NextResponse.json(
        { error: 'Sync record does not belong to this organization' },
        { status: 403 }
      );
    }

    // Reset retry count if requested
    if (resetRetryCount) {
      await prisma.xero_syncs.update({
        where: { id: syncId },
        data: {
          retry_count: 0,
          status: 'PENDING',
          next_retry_at: new Date(),
          error_message: null,
          updated_at: new Date(),
        },
      });

      logger.info({ syncId }, 'Retry count reset to 0');
    }

    // Process the sync
    const result = await processSyncById(syncId);

    if (result.success) {
      logger.info({ syncId }, 'Manual replay succeeded');
      return NextResponse.json({
        success: true,
        message: 'Sync replayed successfully',
        result: result.result,
      });
    } else {
      logger.warn({ syncId, error: result.error }, 'Manual replay failed');
      return NextResponse.json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, 'Error replaying sync');

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}







