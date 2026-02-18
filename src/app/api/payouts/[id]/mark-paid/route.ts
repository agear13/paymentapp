/**
 * Mark Payout Paid API
 * POST /api/payouts/[id]/mark-paid
 * Idempotent: if already PAID, returns 200
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';
import { z } from 'zod';

const MarkPaidSchema = z.object({
  external_reference: z.string().min(1),
  paid_at: z.string().optional(),
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
    const body = await request.json().catch(() => ({}));
    const parsed = MarkPaidSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'external_reference is required', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { external_reference, paid_at } = parsed.data;

    const payout = await prisma.payouts.findUnique({
      where: { id },
      include: { obligation_lines: true },
    });

    if (!payout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }

    const canManage = await checkUserPermission(user.id, payout.organization_id, 'manage_ledger');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (payout.status === 'PAID') {
      return NextResponse.json({
        data: { id: payout.id, status: 'PAID', paidAt: payout.paid_at },
        message: 'Already marked as paid (idempotent)',
      });
    }

    const paidAtDate = paid_at ? new Date(paid_at) : new Date();

    await prisma.$transaction(async (tx) => {
      await tx.payouts.update({
        where: { id },
        data: {
          status: 'PAID',
          external_reference: external_reference,
          paid_at: paidAtDate,
        },
      });
      await tx.commission_obligation_lines.updateMany({
        where: { payout_id: id },
        data: { status: 'PAID', paid_at: paidAtDate },
      });
      // Option B: mark linked commission_obligation_items as PAID
      await tx.commission_obligation_items.updateMany({
        where: { payout_id: id },
        data: { status: 'PAID', paid_at: paidAtDate },
      });
    });

    log.info(
      {
        organizationId: payout.organization_id,
        payoutId: id,
        batchId: payout.batch_id,
        externalReference: external_reference,
      },
      'Payout marked paid'
    );

    return NextResponse.json({
      data: { id: payout.id, status: 'PAID', paidAt: paidAtDate },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
