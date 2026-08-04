/**
 * Xero Sync Statistics API
 * Get sync statistics and failed syncs for error dashboard
 * 
 * Sprint 13: Error Dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getOrganizationSyncQueueSnapshot,
  getSyncStatistics,
} from '@/lib/xero/queue-service';
import { logger } from '@/lib/logger';
import { hasOrganizationPermission } from '@/lib/auth/organization-access';
import { resolveSessionOrganizationId } from '@/lib/organization/resolve-organization-api.server';

/**
 * GET /api/xero/sync/stats?organization_id=xxx
 * 
 * Get sync statistics for an organization
 * 
 * Query params:
 * - organization_id: required
 */
export async function GET(request: NextRequest) {
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

    const resolved = await resolveSessionOrganizationId(
      user.id,
      searchParams.get('organization_id'),
      'xero/sync/stats'
    );
    if (resolved.response) return resolved.response;
    const organizationId = resolved.organizationId;

    const canViewSettings = await hasOrganizationPermission(
      user.id,
      organizationId,
      'view_settings'
    );
    if (!canViewSettings) {
      return NextResponse.json(
        { error: 'Forbidden - insufficient organization permissions' },
        { status: 403 }
      );
    }

    const [stats, queueSnapshot] = await Promise.all([
      getSyncStatistics(organizationId),
      getOrganizationSyncQueueSnapshot(organizationId, 10),
    ]);

    return NextResponse.json({
      success: true,
      data: stats,
      pendingCount: queueSnapshot.pendingCount,
      recentSyncs: queueSnapshot.recentSyncs.map((sync) => ({
        id: sync.id,
        payment_link_id: sync.payment_link_id,
        sync_type: sync.sync_type,
        status: sync.status,
        retry_count: sync.retry_count,
        error_message: sync.error_message,
        created_at: sync.created_at.toISOString(),
        updated_at: sync.updated_at.toISOString(),
      })),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, 'Error fetching sync statistics');

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}







