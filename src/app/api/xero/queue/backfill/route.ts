/**
 * Xero Queue Backfill Endpoint
 * Queues syncs for paid payment links that were never queued
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/server/prisma';
import { queueXeroSync } from '@/lib/xero/queue-service';
import { logger } from '@/lib/logger';

/**
 * POST /api/xero/queue/backfill
 * 
 * Find all PAID payment links without corresponding xero_syncs
 * and queue them for syncing
 */
export async function POST() {
  try {
    // Require authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - please log in' },
        { status: 401 }
      );
    }

    logger.info({ userId: user.id }, 'Starting Xero sync backfill');

    // Get all paid payment links
    const paidPaymentLinks = await prisma.payment_links.findMany({
      where: { status: 'PAID' },
      select: {
        id: true,
        short_code: true,
        amount: true,
        currency: true,
        organization_id: true,
        updated_at: true,
      },
    });

    // Get existing syncs
    const existingSyncs = await prisma.xero_syncs.findMany({
      select: {
        payment_link_id: true,
      },
    });

    const existingSyncPaymentIds = new Set(
      existingSyncs.map((s) => s.payment_link_id)
    );

    // Find paid links without syncs
    const linksWithoutSyncs = paidPaymentLinks.filter(
      (link) => !existingSyncPaymentIds.has(link.id)
    );

    logger.info(
      {
        totalPaid: paidPaymentLinks.length,
        withoutSyncs: linksWithoutSyncs.length,
      },
      'Found payment links to backfill'
    );

    if (linksWithoutSyncs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No payment links need backfilling',
        queued: 0,
      });
    }

    // Queue each missing sync
    const results = [];
    for (const link of linksWithoutSyncs) {
      try {
        const syncId = await queueXeroSync({
          paymentLinkId: link.id,
          organizationId: link.organization_id,
          priority: 0,
        });

        results.push({
          paymentLinkId: link.id,
          shortCode: link.short_code,
          success: true,
          syncId,
        });

        logger.info(
          {
            paymentLinkId: link.id,
            shortCode: link.short_code,
            syncId,
          },
          'Queued sync for payment link'
        );
      } catch (error: any) {
        results.push({
          paymentLinkId: link.id,
          shortCode: link.short_code,
          success: false,
          error: error.message,
        });

        logger.error(
          {
            paymentLinkId: link.id,
            shortCode: link.short_code,
            error: error.message,
          },
          'Failed to queue sync for payment link'
        );
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    logger.info(
      {
        userId: user.id,
        queued: successCount,
        failed: failureCount,
      },
      'Xero sync backfill completed'
    );

    return NextResponse.json({
      success: true,
      message: `Queued ${successCount} syncs for processing`,
      results: {
        queued: successCount,
        failed: failureCount,
        details: results,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, 'Error during Xero sync backfill');

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
 * GET /api/xero/queue/backfill
 * 
 * Preview what would be backfilled without actually doing it
 */
export async function GET() {
  try {
    // Require authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - please log in' },
        { status: 401 }
      );
    }

    // Get all paid payment links
    const paidPaymentLinks = await prisma.payment_links.findMany({
      where: { status: 'PAID' },
      select: {
        id: true,
        short_code: true,
        amount: true,
        currency: true,
        organization_id: true,
        updated_at: true,
      },
    });

    // Get existing syncs
    const existingSyncs = await prisma.xero_syncs.findMany({
      select: {
        payment_link_id: true,
      },
    });

    const existingSyncPaymentIds = new Set(
      existingSyncs.map((s) => s.payment_link_id)
    );

    // Find paid links without syncs
    const linksWithoutSyncs = paidPaymentLinks.filter(
      (link) => !existingSyncPaymentIds.has(link.id)
    );

    return NextResponse.json({
      totalPaidLinks: paidPaymentLinks.length,
      linksWithSyncs: paidPaymentLinks.length - linksWithoutSyncs.length,
      linksWithoutSyncs: linksWithoutSyncs.length,
      previewLinks: linksWithoutSyncs.map((link) => ({
        shortCode: link.shortCode,
        amount: link.amount,
        currency: link.currency,
        paidAt: link.updated_at,
      })),
      message:
        linksWithoutSyncs.length > 0
          ? `POST to this endpoint to queue ${linksWithoutSyncs.length} syncs`
          : 'All paid links already have syncs',
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

