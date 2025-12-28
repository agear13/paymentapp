/**
 * Xero Sync Status API
 * Get sync status for a specific payment link
 * 
 * Sprint 13: Error Dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSyncStatus } from '@/lib/xero/queue-service';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/xero/sync/status?payment_link_id=xxx&organization_id=xxx
 * 
 * Get all sync records for a specific payment link
 * 
 * Query params:
 * - payment_link_id: required
 * - organization_id: required for authorization
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

    // Get parameters from query params
    const { searchParams } = new URL(request.url);
    const paymentLinkId = searchParams.get('payment_link_id');
    const organizationId = searchParams.get('organization_id');

    if (!paymentLinkId || !organizationId) {
      return NextResponse.json(
        { error: 'Missing payment_link_id or organization_id parameter' },
        { status: 400 }
      );
    }

    // Verify payment link belongs to organization
    const paymentLink = await prisma.payment_links.findUnique({
      where: { id: paymentLinkId },
      select: { organization_id: true },
    });

    if (!paymentLink) {
      return NextResponse.json(
        { error: 'Payment link not found' },
        { status: 404 }
      );
    }

    if (paymentLink.organization_id !== organizationId) {
      return NextResponse.json(
        { error: 'Payment link does not belong to this organization' },
        { status: 403 }
      );
    }

    // TODO: Verify user has permission to access this organization

    // Get sync status
    const syncs = await getSyncStatus(paymentLinkId);

    // Determine overall status
    const latestSync = syncs[0];
    const hasSuccessful = syncs.some((s) => s.status === 'SUCCESS');
    const hasPending = syncs.some((s) => s.status === 'PENDING' || s.status === 'RETRYING');
    const hasFailed = syncs.some((s) => s.status === 'FAILED');

    return NextResponse.json({
      success: true,
      data: {
        syncs,
        summary: {
          total: syncs.length,
          latestStatus: latestSync?.status || 'NONE',
          hasSuccessful,
          hasPending,
          hasFailed,
          latestSync: latestSync || null,
        },
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, 'Error fetching sync status');

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}







