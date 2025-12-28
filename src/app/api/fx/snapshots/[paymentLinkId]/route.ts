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
    const { paymentLinkId } = await context.params;

    logger.info({ paymentLinkId }, 'Fetching FX snapshots');

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













