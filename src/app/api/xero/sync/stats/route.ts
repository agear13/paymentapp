/**
 * Xero Sync Statistics API
 * Get sync statistics and failed syncs for error dashboard
 * 
 * Sprint 13: Error Dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getSyncStatistics,
  getFailedSyncs,
  getSyncStatus,
} from '@/lib/xero/queue-service';
import { logger } from '@/lib/logger';

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
    const organizationId = searchParams.get('organization_id');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Missing organization_id parameter' },
        { status: 400 }
      );
    }

    // TODO: Verify user has permission to access this organization

    // Get statistics
    const stats = await getSyncStatistics(organizationId);

    return NextResponse.json({
      success: true,
      data: stats,
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







