import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { refreshDealNetworkPilotObligationsForUser } from '@/lib/deal-network-demo/deal-network-pilot-obligations';
import { linkPaymentEventToPilotDeal } from '@/lib/deal-network-demo/pilot-deal-payment-events.server';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/deal-network-pilot/payment-events/[eventId]
 * Body: { dealId: string } — sets payment_events.pilot_deal_id for explicit deal binding.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const user = await requireAuth();
    const { eventId } = await context.params;
    const id = eventId?.trim();
    if (!id) {
      return NextResponse.json({ error: 'Missing event id' }, { status: 400 });
    }

    const body = (await request.json()) as { dealId?: string };
    const dealId = body.dealId?.trim();
    if (!dealId) {
      return NextResponse.json({ error: 'dealId required' }, { status: 400 });
    }

    const r = await linkPaymentEventToPilotDeal({
      userId: user.id,
      dealId,
      paymentEventId: id,
    });
    if (!r.ok) {
      return NextResponse.json({ error: r.error }, { status: 404 });
    }
    await refreshDealNetworkPilotObligationsForUser(user.id);
    return NextResponse.json({ ok: true, paymentEvent: r.paymentEvent });
  } catch (e: unknown) {
    const err = e as { statusCode?: number; message?: string };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[deal-network-pilot/payment-events/[eventId] PATCH]', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
