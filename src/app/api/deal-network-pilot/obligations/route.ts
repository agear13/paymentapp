import { NextResponse } from 'next/server';
import { DealNetworkPilotObligationStatus } from '@prisma/client';
import { requireAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/server/prisma';

export const dynamic = 'force-dynamic';

const PILOT_OBLIGATION_STATUSES = new Set<string>(
  Object.values(DealNetworkPilotObligationStatus)
);

/**
 * GET /api/deal-network-pilot/obligations?dealId=&status=&participantId=
 * Lists derived obligation rows for the authenticated pilot user (read-only).
 * Includes deal, participant, and payment_event for operator views.
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const dealId = searchParams.get('dealId')?.trim();
    const statusParam = searchParams.get('status')?.trim();
    const participantId = searchParams.get('participantId')?.trim();

    const statusFilter =
      statusParam && PILOT_OBLIGATION_STATUSES.has(statusParam)
        ? (statusParam as DealNetworkPilotObligationStatus)
        : undefined;

    const rows = await prisma.deal_network_pilot_obligations.findMany({
      where: {
        user_id: user.id,
        ...(dealId ? { deal_id: dealId } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(participantId ? { participant_id: participantId } : {}),
      },
      orderBy: [{ deal_id: 'asc' }, { created_at: 'asc' }],
      include: {
        deal: {
          select: { id: true, name: true, partner: true },
        },
        participant: {
          select: { id: true, name: true, role: true, email: true },
        },
        payment_event: {
          select: {
            id: true,
            source_type: true,
            payment_link_id: true,
            event_type: true,
            gross_amount: true,
            amount_received: true,
            currency_received: true,
            received_at: true,
          },
        },
      },
    });

    return NextResponse.json({ data: rows });
  } catch (e: unknown) {
    const err = e as { statusCode?: number; message?: string };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[deal-network-pilot/obligations GET]', e);
    return NextResponse.json({ error: 'Failed to load obligations' }, { status: 500 });
  }
}
