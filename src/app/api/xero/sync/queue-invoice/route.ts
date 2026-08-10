/**
 * Queue a single invoice (payment link) for accounting sync on user request.
 * Idempotent: already-synced invoices are not re-queued unless update=true.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { hasOrganizationPermission } from '@/lib/auth/organization-access';
import { resolveSessionOrganizationId } from '@/lib/organization/resolve-organization-api.server';
import { prisma } from '@/lib/server/prisma';
import { logger } from '@/lib/logger';
import { queueXeroSync, queueXeroInvoiceUpdate } from '@/lib/xero/queue-service';
import { getConnectionStatus } from '@/lib/xero';
import config from '@/lib/config/env';
import {
  isAccountingInvoiceExported,
  resolveAccountingPushState,
} from '@/lib/accounting/accounting-push-state';

export async function POST(request: NextRequest) {
  try {
    const auth = await getCurrentUserForApi(request);
    if (!auth.user) return auth.response!;
    const user = auth.user;

    const { searchParams } = new URL(request.url);
    const resolved = await resolveSessionOrganizationId(
      user.id,
      searchParams.get('organization_id'),
      'xero/sync/queue-invoice'
    );
    if (resolved.response) return resolved.response;
    const organizationId = resolved.organizationId;

    const canCreate = await hasOrganizationPermission(
      user.id,
      organizationId,
      'create_payment_links'
    );
    if (!canCreate) {
      return NextResponse.json(
        { error: 'Forbidden - insufficient organization permissions' },
        { status: 403 }
      );
    }

    const body = (await request.json()) as { paymentLinkId?: string; update?: boolean };
    const paymentLinkId = body.paymentLinkId?.trim();
    const updateRequested = body.update === true;
    if (!paymentLinkId) {
      return NextResponse.json({ error: 'Missing paymentLinkId' }, { status: 400 });
    }

    const link = await prisma.payment_links.findFirst({
      where: { id: paymentLinkId, organization_id: organizationId },
      select: {
        id: true,
        status: true,
        updated_at: true,
        amount: true,
        currency: true,
        invoice_currency: true,
        description: true,
        customer_email: true,
        customer_name: true,
        invoice_reference: true,
        invoice_date: true,
        due_date: true,
      },
    });
    if (!link) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (!config.features.xeroSync) {
      return NextResponse.json(
        { error: 'Accounting sync is not enabled on this server.' },
        { status: 503 }
      );
    }

    const connection = await getConnectionStatus(organizationId);
    if (!connection.connected) {
      return NextResponse.json(
        { error: 'Accounting is not connected. Connect accounting before pushing invoices.' },
        { status: 409 }
      );
    }

    const invoiceSync = await prisma.xero_syncs.findUnique({
      where: {
        xero_syncs_payment_link_sync_type_unique: {
          payment_link_id: paymentLinkId,
          sync_type: 'INVOICE',
        },
      },
      select: {
        id: true,
        sync_type: true,
        status: true,
        xero_invoice_id: true,
        updated_at: true,
        created_at: true,
        response_payload: true,
      },
    });

    const pushState = resolveAccountingPushState({
      invoiceSync: invoiceSync
        ? {
            syncType: invoiceSync.sync_type,
            status: invoiceSync.status,
            xeroInvoiceId: invoiceSync.xero_invoice_id,
            updatedAt: invoiceSync.updated_at,
            createdAt: invoiceSync.created_at,
            responsePayload: invoiceSync.response_payload,
          }
        : null,
      linkUpdatedAt: link.updated_at,
      link: {
        amount: link.amount,
        invoiceCurrency: link.invoice_currency,
        currency: link.currency,
        description: link.description,
        customerEmail: link.customer_email,
        customerName: link.customer_name,
        invoiceReference: link.invoice_reference,
        invoiceDate: link.invoice_date,
        dueDate: link.due_date,
      },
    });

    if (updateRequested) {
      if (
        pushState.state !== 'update' &&
        !isAccountingInvoiceExported(
          invoiceSync
            ? {
                syncType: invoiceSync.sync_type,
                status: invoiceSync.status,
                xeroInvoiceId: invoiceSync.xero_invoice_id,
              }
            : null
        )
      ) {
        return NextResponse.json(
          { error: 'No exported accounting invoice exists to update' },
          { status: 409 }
        );
      }

      const syncId = await queueXeroInvoiceUpdate({ paymentLinkId, organizationId });
      logger.info({ syncId, paymentLinkId, organizationId }, 'Manual accounting invoice update queued');

      return NextResponse.json({
        syncId,
        queued: true,
        update: true,
        message: 'Accounting record update queued.',
      });
    }

    if (pushState.state === 'already_synced') {
      return NextResponse.json({
        syncId: invoiceSync?.id ?? null,
        alreadySynced: true,
        queued: false,
        lastSyncedAt: pushState.lastSyncedAt,
        xeroInvoiceId: pushState.xeroInvoiceId,
        message: 'This invoice is already synced to your accounting software.',
      });
    }

    if (pushState.state === 'sync_pending') {
      return NextResponse.json({
        syncId: invoiceSync?.id ?? null,
        alreadySynced: false,
        queued: false,
        inProgress: true,
        message: 'Accounting sync is already in progress for this invoice.',
      });
    }

    const syncId = await queueXeroSync({
      paymentLinkId,
      organizationId,
      syncType: 'INVOICE',
    });

    logger.info({ syncId, paymentLinkId, organizationId }, 'Manual invoice accounting sync queued');

    return NextResponse.json({
      syncId,
      queued: true,
      alreadySynced: false,
      message: 'Invoice queued for accounting sync.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to queue accounting sync';
    logger.error({ error: message }, 'queue-invoice failed');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
