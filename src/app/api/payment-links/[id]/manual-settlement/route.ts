/**
 * POST /api/payment-links/[id]/manual-settlement
 * Operator-only: mark invoice as paid without checkout, or reopen after a mistaken mark.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';
import { transitionPaymentLinkStatus } from '@/lib/payment-link-state-machine';

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

    const auth = await requireAuth(request);
    if (!auth.user) return auth.response!;
    const { user } = auth;

    const { id } = await params;
    const link = await prisma.payment_links.findUnique({
      where: { id },
      select: { id: true, organization_id: true, status: true },
    });

    if (!link) {
      return NextResponse.json({ error: 'Payment link not found' }, { status: 404 });
    }

    const canEdit = await checkUserPermission(user.id, link.organization_id, 'edit_payment_links');
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 });
    }

    const json = await request.json();
    const { action } = bodySchema.parse(json);

    if (action === 'mark_paid') {
      if (link.status !== 'OPEN') {
        return NextResponse.json(
          { error: 'Only open invoices can be marked paid manually' },
          { status: 400 }
        );
      }
      await transitionPaymentLinkStatus(link.id, 'PAID', user.id);
    } else {
      if (link.status !== 'PAID') {
        return NextResponse.json(
          { error: 'Only paid invoices can be reopened for correction' },
          { status: 400 }
        );
      }
      await transitionPaymentLinkStatus(link.id, 'OPEN', user.id);
    }

    loggers.api.info({ paymentLinkId: id, action, userId: user.id }, 'Manual invoice settlement');

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal server error';
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: e.errors }, { status: 400 });
    }
    loggers.api.error({ error: message }, 'manual-settlement failed');
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
