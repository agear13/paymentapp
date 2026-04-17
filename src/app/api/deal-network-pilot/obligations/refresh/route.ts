import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import {
  refreshDealNetworkPilotObligationsForDeal,
  refreshDealNetworkPilotObligationsForUser,
} from '@/lib/deal-network-demo/deal-network-pilot-obligations';
import { getPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/deal-network-pilot/obligations/refresh
 * Rebuilds derived obligation rows from current pilot deal + participant data (read-only on source tables).
 * Body: { dealId?: string } — omit dealId to refresh all deals for the authenticated user.
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = (await request.json().catch(() => ({}))) as { dealId?: string };
    const dealId = typeof body.dealId === 'string' ? body.dealId.trim() : '';

    if (dealId) {
      const { deals, participants } = await getPilotSnapshotForUser(user.id);
      const deal = deals.find((d) => d.id === dealId);
      if (!deal) {
        return NextResponse.json({ error: 'Deal not found for this user' }, { status: 404 });
      }
      await refreshDealNetworkPilotObligationsForDeal(user.id, deal, participants);
    } else {
      await refreshDealNetworkPilotObligationsForUser(user.id);
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { statusCode?: number; message?: string };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[deal-network-pilot/obligations/refresh POST]', e);
    return NextResponse.json({ error: 'Failed to refresh obligations' }, { status: 500 });
  }
}
