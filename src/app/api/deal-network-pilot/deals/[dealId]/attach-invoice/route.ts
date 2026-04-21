/**
 * POST — attach an existing payment link (invoice) to a Strait pilot project.
 * Coordination only: sets payment_links.pilot_deal_id; does not change payment rails.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/server/prisma';
import {
  assertPilotDealOwnedByUser,
  findPaymentLinkForAttach,
} from '@/lib/deal-network-demo/pilot-deal-invoice-link.server';
import { refreshDealNetworkPilotObligationsForDeal } from '@/lib/deal-network-demo/deal-network-pilot-obligations';
import { getPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';

export const dynamic = 'force-dynamic';

const bodySchema = z
  .object({
    paymentLinkId: z.string().uuid().optional(),
    /** Full pay URL, path `/pay/{shortCode}`, or raw short code */
    paymentUrlOrCode: z.string().optional(),
  })
  .refine((b) => Boolean(b.paymentLinkId?.trim()) || Boolean(b.paymentUrlOrCode?.trim()), {
    message: 'Provide paymentLinkId or paymentUrlOrCode',
  });

function extractShortCodeFromPayUrl(input: string): string | null {
  const m = input.match(/\/pay\/([^/?#]+)/i);
  return m?.[1] ? decodeURIComponent(m[1].trim()) : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
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

    const { dealId } = await params;
    await assertPilotDealOwnedByUser(user.id, dealId);

    const json = await request.json();
    const body = bodySchema.parse(json);

    let lookup = body.paymentLinkId?.trim() ?? '';
    if (!lookup && body.paymentUrlOrCode) {
      const raw = body.paymentUrlOrCode.trim();
      lookup = extractShortCodeFromPayUrl(raw) ?? raw;
    }

    const link = await findPaymentLinkForAttach(lookup);
    if (!link) {
      return NextResponse.json({ error: 'Payment link not found' }, { status: 404 });
    }

    const canEdit = await checkUserPermission(user.id, link.organization_id, 'edit_payment_links');
    if (!canEdit) {
      return NextResponse.json(
        { error: 'You do not have permission to link invoices for this organization.' },
        { status: 403 }
      );
    }

    await prisma.payment_links.update({
      where: { id: link.id },
      data: { pilot_deal_id: dealId, updated_at: new Date() },
    });

    const snapshot = await getPilotSnapshotForUser(user.id);
    const deal = snapshot.deals.find((d) => d.id === dealId);
    if (deal) {
      await refreshDealNetworkPilotObligationsForDeal(user.id, deal, snapshot.participants);
    }

    return NextResponse.json({ ok: true, paymentLinkId: link.id });
  } catch (e: unknown) {
    const err = e as { statusCode?: number; message?: string; name?: string };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid request', details: String(err.message) }, { status: 400 });
    }
    const message = err.message || 'Failed to attach invoice';
    if (message.includes('not found') || message.includes('access denied')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error('[attach-invoice]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
