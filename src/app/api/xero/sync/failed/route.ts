/**
 * Failed Xero Syncs API
 * Get list of failed syncs for error dashboard
 * 
 * Sprint 13: Error Dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFailedSyncs } from '@/lib/xero/queue-service';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/xero/sync/failed?organization_id=xxx&limit=50
 * 
 * Get failed sync records for an organization
 * 
 * Query params:
 * - organization_id: required
 * - limit: optional (default: 50, max: 200)
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
    const limitParam = searchParams.get('limit');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Missing organization_id parameter' },
        { status: 400 }
      );
    }

    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 200) : 50;

    // TODO: Verify user has permission to access this organization

    // Get failed syncs for organization
    const failedSyncs = await prisma.xero_syncs.findMany({
      where: {
        status: 'FAILED',
        payment_links: {
          organization_id: organizationId,
        },
      },
      orderBy: { updated_at: 'desc' },
      take: limit,
      include: {
        payment_links: {
          select: {
            id: true,
            organization_id: true,
            amount: true,
            currency: true,
            invoice_reference: true,
            status: true,
            created_at: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: failedSyncs,
      count: failedSyncs.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, 'Error fetching failed syncs');

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}







