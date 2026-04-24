/**
 * POST /api/payment-links/[id]/manual-settlement
 * Operator-only: mark invoice as paid without checkout, or reopen after a mistaken mark.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import { requireAuth } from '@/lib/auth/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';
import { transitionPaymentLinkStatus } from '@/lib/payment-link-state-machine';
import { paymentEventBlocksReopenAfterPaid } from '@/lib/payments/payment-link-external-evidence';
import { revalidatePath } from 'next/cache';

const bodySchema = z.object({
  action: z.enum(['mark_paid', 'reopen']),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const link = await prisma.payment_links.findUnique({
      where: { id },
      select: {
        id: true,
        organization_id: true,
        status: true,
        short_code: true,
        wise_transfer_id: true,
        wise_received_amount: true,
      },
    });

    if (!link) {
      return NextResponse.json({ error: 'Payment link not found' }, { status: 404 });
    }

    const [canEdit, canCancel] = await Promise.all([
      checkUserPermission(user.id, link.organization_id, 'edit_payment_links'),
      checkUserPermission(user.id, link.organization_id, 'cancel_payment_links'),
    ]);
    if (!canEdit && !canCancel) {
      return NextResponse.json(
        {
          error:
            'You do not have permission to mark invoices as paid or reopen them. Required permission: edit invoices.',
        },
        { status: 403 }
      );
    }

    const json = await request.json();
    const { action } = bodySchema.parse(json);

    const settlementEvidence = await prisma.payment_events.findMany({
      where: { payment_link_id: link.id },
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

    const hasExternalSettlementEvidence =
      Boolean(link.wise_transfer_id) ||
      Boolean(link.wise_received_amount) ||
      settlementEvidence.some((event) => paymentEventBlocksReopenAfterPaid(event));

    if (action === 'mark_paid') {
      if (link.status !== 'OPEN') {
        return NextResponse.json(
          { error: 'Only open invoices can be marked paid manually' },
          { status: 400 }
        );
      }
      await transitionPaymentLinkStatus(link.id, 'PAID', user.id);
    } else {
      if (
        link.status !== 'PAID' &&
        link.status !== 'PAID_UNVERIFIED' &&
        link.status !== 'REQUIRES_REVIEW'
      ) {
        return NextResponse.json(
          {
            error: `Only invoices that are paid or awaiting verification can be reopened (current status: ${link.status}).`,
          },
          { status: 400 }
        );
      }
      if (hasExternalSettlementEvidence) {
        return NextResponse.json(
          {
            error:
              'Cannot reopen: this invoice has recorded payment or settlement evidence (card, bank, chain, or confirmed amounts). Use your processor’s refund or reversal flow instead.',
            code: 'REOPEN_BLOCKED_EVIDENCE',
          },
          { status: 400 }
        );
      }
      await transitionPaymentLinkStatus(link.id, 'OPEN', user.id);
    }

    loggers.api.info('Manual invoice settlement');

    revalidatePath(`/pay/${link.short_code}`);
    revalidatePath('/dashboard/payment-links');

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal server error';
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: e.issues }, { status: 400 });
    }
    loggers.api.error('manual-settlement failed');
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
