/**
 * POST /api/payment-links/[id]/settlements/[settlementId]/mark-settled
 * Temporary manual settlement completion — future provider adapters will automate this.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { AuthError } from '@/lib/auth/errors';
import { checkUserPermission } from '@/lib/auth/permissions';
import { prisma } from '@/lib/server/prisma';
import { recordManualSettlementCompleted } from '@/lib/payments/payment-lifecycle';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; settlementId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id, settlementId } = await params;
    const body = await request.json().catch(() => ({}));

    const settlement = await prisma.payment_settlements.findFirst({
      where: { id: settlementId, payment_link_id: id },
      select: {
        id: true,
        status: true,
        organization_id: true,
        payment_link_id: true,
      },
    });

    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    const hasPermission = await checkUserPermission(
      user.id,
      settlement.organization_id,
      'edit_payment_links'
    );
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (settlement.status === 'SETTLED' || settlement.status === 'RECONCILED') {
      return NextResponse.json({
        data: { settlementId, status: settlement.status, alreadySettled: true },
      });
    }

    await recordManualSettlementCompleted({
      paymentLinkId: settlement.payment_link_id,
      organizationId: settlement.organization_id,
      settlementId: settlement.id,
      actor: user.id,
      reference: typeof body.reference === 'string' ? body.reference : null,
    });

    const updated = await prisma.payment_settlements.findUnique({
      where: { id: settlementId },
    });

    return NextResponse.json({
      data: {
        settlementId,
        status: updated?.status ?? 'SETTLED',
        settledAt: updated?.settled_at ?? new Date(),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to mark settlement settled', details: message },
      { status: 500 }
    );
  }
}
