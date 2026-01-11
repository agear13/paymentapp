/**
 * Xero Debug Endpoint
 * Shows detailed sync status for troubleshooting
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/server/prisma';

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

    // Get all xero syncs
    const allSyncs = await prisma.xero_syncs.findMany({
      orderBy: { created_at: 'desc' },
      take: 50,
      include: {
        payment_links: {
          select: {
            id: true,
            short_code: true,
            status: true,
            amount: true,
            currency: true,
            organization_id: true,
          },
        },
      },
    });

    // Get all paid payment links
    const paidPaymentLinks = await prisma.payment_links.findMany({
      where: { status: 'PAID' },
      orderBy: { updated_at: 'desc' },
      take: 50,
      select: {
        id: true,
        short_code: true,
        status: true,
        amount: true,
        currency: true,
        organization_id: true,
        created_at: true,
        updated_at: true,
      },
    });

    // Check which paid links have syncs
    const paidLinksWithoutSyncs = paidPaymentLinks.filter(
      (link) => !allSyncs.some((sync) => sync.payment_link_id === link.id)
    );

    // Count by status
    const syncsByStatus = {
      PENDING: allSyncs.filter((s) => s.status === 'PENDING').length,
      SUCCESS: allSyncs.filter((s) => s.status === 'SUCCESS').length,
      FAILED: allSyncs.filter((s) => s.status === 'FAILED').length,
      RETRYING: allSyncs.filter((s) => s.status === 'RETRYING').length,
    };

    // Check Xero connection
    const xeroConnection = await prisma.xero_connections.findFirst({
      select: {
        id: true,
        organization_id: true,
        tenant_id: true,
        expires_at: true,
        connected_at: true,
      },
    });

    // Get recent payment events
    const recentPaymentEvents = await prisma.payment_events.findMany({
      where: { event_type: 'PAYMENT_CONFIRMED' },
      orderBy: { created_at: 'desc' },
      take: 10,
      select: {
        id: true,
        payment_link_id: true,
        event_type: true,
        payment_method: true,
        created_at: true,
      },
    });

    return NextResponse.json({
      summary: {
        totalSyncs: allSyncs.length,
        syncsByStatus,
        paidPaymentLinks: paidPaymentLinks.length,
        paidLinksWithoutSyncs: paidLinksWithoutSyncs.length,
        xeroConnected: !!xeroConnection,
        xeroTokenExpired: xeroConnection
          ? new Date(xeroConnection.expires_at) < new Date()
          : null,
      },
      xeroConnection: xeroConnection
        ? {
            tenantId: xeroConnection.tenant_id,
            expiresAt: xeroConnection.expires_at,
            isExpired: new Date(xeroConnection.expires_at) < new Date(),
            connectedAt: xeroConnection.connected_at,
          }
        : null,
      allSyncs: allSyncs.map((sync) => ({
        id: sync.id,
        paymentLinkId: sync.payment_link_id,
        shortCode: sync.payment_links?.short_code,
        amount: sync.payment_links?.amount,
        currency: sync.payment_links?.currency,
        syncType: sync.sync_type,
        status: sync.status,
        retryCount: sync.retry_count,
        errorMessage: sync.error_message,
        xeroInvoiceId: sync.xero_invoice_id,
        xeroPaymentId: sync.xero_payment_id,
        createdAt: sync.created_at,
        updatedAt: sync.updated_at,
        nextRetryAt: sync.next_retry_at,
      })),
      paidLinksWithoutSyncs: paidLinksWithoutSyncs.map((link) => ({
        id: link.id,
        shortCode: link.short_code,
        amount: link.amount,
        currency: link.currency,
        status: link.status,
        createdAt: link.created_at,
        updatedAt: link.updated_at,
      })),
      recentPaymentEvents: recentPaymentEvents.map((event) => ({
        id: event.id,
        paymentLinkId: event.payment_link_id,
        eventType: event.event_type,
        paymentMethod: event.payment_method,
        createdAt: event.created_at,
      })),
      diagnostics: {
        hasPaidLinks: paidPaymentLinks.length > 0,
        hasSyncs: allSyncs.length > 0,
        hasSuccessfulSyncs: syncsByStatus.SUCCESS > 0,
        hasPendingSyncs: syncsByStatus.PENDING > 0,
        hasFailedSyncs: syncsByStatus.FAILED > 0,
        needsProcessing: syncsByStatus.PENDING > 0 || syncsByStatus.RETRYING > 0,
        possibleIssues: [
          !xeroConnection && 'Xero not connected',
          xeroConnection &&
            new Date(xeroConnection.expires_at) < new Date() &&
            'Xero token expired',
          paidLinksWithoutSyncs.length > 0 &&
            `${paidLinksWithoutSyncs.length} paid link(s) never queued for sync`,
          syncsByStatus.PENDING > 0 && 'Pending syncs need processing',
          syncsByStatus.FAILED > 0 && 'Failed syncs need attention',
        ].filter(Boolean),
      },
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

