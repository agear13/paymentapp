/**
 * GET /api/stripe/active-checkout-session?paymentLinkId=
 * Returns the single active chargeable Checkout Session for a payment link (page refresh reuse).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { applyRateLimit } from '@/lib/rate-limit';
import { getActiveStripeCheckoutSession } from '@/lib/stripe/checkout-session-coordinator.server';

const querySchema = z.object({
  paymentLinkId: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, 'public');
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const paymentLinkId = request.nextUrl.searchParams.get('paymentLinkId');
  const parsed = querySchema.safeParse({ paymentLinkId });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid paymentLinkId' }, { status: 400 });
  }

  const active = await getActiveStripeCheckoutSession({
    paymentLinkId: parsed.data.paymentLinkId,
  });

  if (!active) {
    return NextResponse.json({ active: false }, { status: 200 });
  }

  return NextResponse.json({
    active: true,
    sessionId: active.sessionId,
    url: active.url,
    reused: true,
  });
}
