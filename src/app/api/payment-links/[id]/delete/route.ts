/**
 * POST /api/payment-links/[id]/delete
 * Permanently delete an invoice when it is safe to do so.
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/auth/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';
import { loggers } from '@/lib/logger';
import { tryDeletePaymentLinkAttachmentFile } from '@/lib/payment-links/payment-link-attachment';
import { paymentEventBlocksHardDelete } from '@/lib/payments/payment-link-external-evidence';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const link = await prisma.payment_links.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        organization_id: true,
        short_code: true,
        wise_transfer_id: true,
        wise_received_amount: true,
        attachment_storage_key: true,
        attachment_bucket: true,
      },
    });

    if (!link) {
      return NextResponse.json({ error: 'Payment link not found' }, { status: 404 });
    }

    const canDelete = await checkUserPermission(user.id, link.organization_id, 'delete_payment_links');
    if (!canDelete) {
      return NextResponse.json(
        {
          error:
            'You do not have permission to permanently delete invoices. Ask an organization owner or admin.',
        },
        { status: 403 }
      );
    }

    if (link.status === 'PAID') {
      return NextResponse.json(
        { error: 'Paid invoices cannot be deleted.' },
        { status: 400 }
      );
    }

    if (!['DRAFT', 'OPEN', 'CANCELED'].includes(link.status)) {
      return NextResponse.json(
        {
          error: `Only draft, open, or canceled invoices can be deleted (current status: ${link.status}).`,
        },
        { status: 400 }
      );
    }

    const paymentActivity = await prisma.payment_events.findMany({
      where: { payment_link_id: id },
      select: {
        event_type: true,
        amount_received: true,
        stripe_payment_intent_id: true,
        hedera_transaction_id: true,
        wise_transfer_id: true,
        source_reference: true,
        source_type: true,
      },
      take: 20,
      orderBy: { created_at: 'desc' },
    });

    const hasIrreversibleActivity =
      Boolean(link.wise_transfer_id) ||
      Boolean(link.wise_received_amount) ||
      paymentActivity.some((e) => paymentEventBlocksHardDelete(e));

    if (link.status !== 'DRAFT' && hasIrreversibleActivity) {
      return NextResponse.json(
        {
          error:
            'Cannot delete because payment or settlement evidence exists on this invoice. Cancel the invoice instead, or reopen it if it was marked paid by mistake.',
          code: 'DELETE_BLOCKED_EVIDENCE',
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.audit_logs.create({
        data: {
          organization_id: link.organization_id,
          user_id: user.id,
          entity_type: 'PaymentLink',
          entity_id: link.id,
          action: 'DELETE',
          old_values: {
            shortCode: link.short_code,
            status: link.status,
          },
        },
      });

      await tx.payment_links.delete({
        where: { id: link.id },
      });
    });

    if (link.attachment_storage_key) {
      await tryDeletePaymentLinkAttachmentFile(link.attachment_storage_key, link.attachment_bucket);
    }

    loggers.api.info(
      { paymentLinkId: link.id, shortCode: link.short_code, userId: user.id },
      'Payment link deleted'
    );

    revalidatePath(`/pay/${link.short_code}`);
    revalidatePath('/dashboard/payment-links');

    return NextResponse.json({ success: true, message: 'Invoice deleted successfully' });
  } catch (error: any) {
    loggers.api.error(
      { paymentLinkId: params.id, error: error?.message },
      'Failed to delete payment link'
    );
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

