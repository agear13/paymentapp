import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { refreshDealNetworkPilotObligationsForUser } from '@/lib/deal-network-demo/deal-network-pilot-obligations';
import {
  createManualPilotDealPaymentEvent,
  linkLatestConfirmedPaymentFromPaymentLinkToPilotDeal,
  linkPaymentEventToPilotDeal,
} from '@/lib/deal-network-demo/pilot-deal-payment-events.server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/deal-network-pilot/deals/[dealId]/payment-events
 *
 * Manual / explicit linkage of real payment state to a pilot deal (additive).
 * Modes:
 * - manual (default): record PAYMENT_CONFIRMED without a payment_links row
 * - link_payment_event: attach an existing payment_events row to this deal
 * - link_payment_link: attach latest PAYMENT_CONFIRMED for a payment link to this deal
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ dealId: string }> }
) {
  try {
    const user = await requireAuth();
    const { dealId } = await context.params;
    const id = dealId?.trim();
    if (!id) {
      return NextResponse.json({ error: 'Missing deal id' }, { status: 400 });
    }

    const body = (await request.json()) as {
      mode?: 'manual' | 'link_payment_event' | 'link_payment_link';
      amount?: number;
      currency?: string;
      sourceType?: 'MANUAL' | 'CSV_IMPORT';
      sourceReference?: string;
      rawPayloadJson?: unknown;
      receivedAt?: string;
      paymentEventId?: string;
      paymentLinkId?: string;
    };

    const mode = body.mode ?? 'manual';

    if (mode === 'link_payment_event') {
      const pe = body.paymentEventId?.trim();
      if (!pe) {
        return NextResponse.json({ error: 'paymentEventId required' }, { status: 400 });
      }
      const r = await linkPaymentEventToPilotDeal({
        userId: user.id,
        dealId: id,
        paymentEventId: pe,
      });
      if (!r.ok) {
        return NextResponse.json({ error: r.error }, { status: 404 });
      }
      await refreshDealNetworkPilotObligationsForUser(user.id);
      return NextResponse.json({ ok: true, paymentEvent: r.paymentEvent });
    }

    if (mode === 'link_payment_link') {
      const pl = body.paymentLinkId?.trim();
      if (!pl) {
        return NextResponse.json({ error: 'paymentLinkId required' }, { status: 400 });
      }
      const r = await linkLatestConfirmedPaymentFromPaymentLinkToPilotDeal({
        userId: user.id,
        dealId: id,
        paymentLinkId: pl,
      });
      if (!r.ok) {
        return NextResponse.json({ error: r.error }, { status: 404 });
      }
      await refreshDealNetworkPilotObligationsForUser(user.id);
      return NextResponse.json({ ok: true, paymentEvent: r.paymentEvent });
    }

    const amount = body.amount;
    const currency = body.currency;
    if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
      return NextResponse.json({ error: 'amount required' }, { status: 400 });
    }
    if (!currency?.trim()) {
      return NextResponse.json({ error: 'currency required' }, { status: 400 });
    }

    const sourceType = body.sourceType === 'CSV_IMPORT' ? 'CSV_IMPORT' : 'MANUAL';
    const receivedAt = body.receivedAt ? new Date(body.receivedAt) : null;
    if (receivedAt && Number.isNaN(receivedAt.getTime())) {
      return NextResponse.json({ error: 'invalid receivedAt' }, { status: 400 });
    }

    const r = await createManualPilotDealPaymentEvent({
      userId: user.id,
      dealId: id,
      amount: Number(amount),
      currency: currency.trim(),
      sourceType,
      sourceReference: body.sourceReference ?? null,
      rawPayloadJson: body.rawPayloadJson,
      receivedAt: receivedAt ?? undefined,
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
    console.error('[deal-network-pilot/deals/[dealId]/payment-events POST]', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
