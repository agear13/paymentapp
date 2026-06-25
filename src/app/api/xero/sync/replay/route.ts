/**
 * Manual Xero Sync Replay API
 * Allows manual replay of failed or specific sync jobs
 * 
 * Sprint 13: Manual Replay
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { processSyncById } from '@/lib/xero/queue-processor';
import { prisma } from '@/lib/server/prisma';
import { logger } from '@/lib/logger';
import { hasOrganizationPermission } from '@/lib/auth/organization-access';
import { resolveSessionOrganizationId } from '@/lib/organization/resolve-organization-api.server';

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
    const auth = await getCurrentUserForApi(request);
    if (!auth.user) return auth.response!;
    const user = auth.user;

    // Get organization from query params
    const { searchParams } = new URL(request.url);

    const resolved = await resolveSessionOrganizationId(
      user.id,
      searchParams.get('organization_id'),
      'xero/sync/replay'
    );
    if (resolved.response) return resolved.response;
    const organizationId = resolved.organizationId;

    const canManageSettings = await hasOrganizationPermission(
      user.id,
      organizationId,
      'manage_settings'
    );
    if (!canManageSettings) {
      return NextResponse.json(
        { error: 'Forbidden - insufficient organization permissions' },
        { status: 403 }
      );
    }

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







