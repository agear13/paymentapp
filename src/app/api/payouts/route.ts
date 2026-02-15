/**
 * Payouts API
 * GET /api/payouts - List payouts (filter by batchId, userId)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const auth = await requireAuth(request);
    if (!auth.user) return auth.response!;
    const { user } = auth;

    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const batchId = searchParams.get('batchId');
    const userId = searchParams.get('userId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 200);

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const canView = await checkUserPermission(user.id, organizationId, 'view_payment_links');
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const where: { organization_id: string; batch_id?: string; user_id?: string } = {
      organization_id: organizationId,
    };
    if (batchId) where.batch_id = batchId;
    if (userId) where.user_id = userId;

    const payouts = await prisma.payouts.findMany({
      where,
      include: {
        payout_methods: { select: { method_type: true, handle: true, notes: true } },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      data: payouts.map((p) => ({
        id: p.id,
        batchId: p.batch_id,
        userId: p.user_id,
        currency: p.currency,
        grossAmount: Number(p.gross_amount),
        feeAmount: Number(p.fee_amount),
        netAmount: Number(p.net_amount),
        status: p.status,
        externalReference: p.external_reference,
        paidAt: p.paid_at,
        failedReason: p.failed_reason,
        createdAt: p.created_at,
        method: p.payout_methods
          ? {
              type: p.payout_methods.method_type,
              handle: p.payout_methods.handle,
              notes: p.payout_methods.notes,
            }
          : null,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
