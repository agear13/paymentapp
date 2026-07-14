/**
 * FX Snapshots API Endpoint
 * 
 * GET /api/fx/snapshots/[paymentLinkId]
 * 
 * Get FX snapshots for a payment link
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFxService } from '@/lib/fx';
import { log } from '@/lib/logger';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { prisma } from '@/lib/server/prisma';

const logger = log.child({ domain: 'api:fx:snapshots' });

/**
 * GET /api/fx/snapshots/[paymentLinkId]
 * 
 * Get all FX snapshots for a payment link
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ paymentLinkId: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (!auth.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentLinkId } = await context.params;

    const paymentLink = await prisma.payment_links.findUnique({
      where: { id: paymentLinkId },
      select: { id: true, organization_id: true },
    });

    if (!paymentLink) {
      return NextResponse.json({ success: false, error: 'Payment link not found' }, { status: 404 });
    }

    const canView = await checkUserPermission(
      auth.user.id,
      paymentLink.organization_id,
      'view_payment_links'
    );
    if (!canView) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    logger.info({ paymentLinkId, userId: auth.user.id }, 'Fetching FX snapshots');

    const fxService = getFxService();

    // Get snapshots
    const snapshots = await fxService.getSnapshots(paymentLinkId);

    // Calculate variance if both snapshots exist
    const variance = await fxService.calculateRateVariance(paymentLinkId);

    return NextResponse.json({
      success: true,
      data: {
        snapshots,
        variance,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch snapshots');

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch snapshots',
      },
      { status: 500 }
    );
  }
}













