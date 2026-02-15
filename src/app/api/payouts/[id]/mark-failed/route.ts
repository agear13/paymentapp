/**
 * Mark Payout Failed API
 * POST /api/payouts/[id]/mark-failed
 * Unassigns obligation lines (payout_id = null) so they can be re-batched
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';
import { z } from 'zod';

const MarkFailedSchema = z.object({
  failed_reason: z.string().min(1),
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
    const parsed = MarkFailedSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'failed_reason is required', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { failed_reason } = parsed.data;

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

    await prisma.$transaction(async (tx) => {
      await tx.payouts.update({
        where: { id },
        data: { status: 'FAILED', failed_reason: failed_reason },
      });
      await tx.commission_obligation_lines.updateMany({
        where: { payout_id: id },
        data: { payout_id: null, status: 'POSTED', paid_at: null },
      });
    });

    log.info(
      {
        organizationId: payout.organization_id,
        payoutId: id,
        failedReason: failed_reason,
      },
      'Payout marked failed, obligation lines unassigned'
    );

    return NextResponse.json({
      data: { id: payout.id, status: 'FAILED' },
      message: 'Obligation lines unassigned for re-batching',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
