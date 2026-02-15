/**
 * Referral Checkout API (Option B)
 * POST /api/referral/[code]/checkout - Create Stripe Checkout Session for commission-enabled referral
 */

import { NextRequest, NextResponse } from 'next/server';
import { createReferralCheckoutSession } from '@/lib/referrals/referral-checkout';
import { applyRateLimit } from '@/lib/rate-limit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'public');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { code } = await params;
    if (!code?.trim()) {
      return NextResponse.json({ error: 'Referral code is required' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const successUrl = body.successUrl || body.success_url;
    const cancelUrl = body.cancelUrl || body.cancel_url;
    const amountRaw =
      typeof body.amount === 'number'
        ? body.amount
        : typeof body.amount === 'string'
          ? parseFloat(body.amount)
          : undefined;
    const amount = typeof amountRaw === 'number' && !Number.isNaN(amountRaw) ? amountRaw : undefined;
    const currency = typeof body.currency === 'string' ? body.currency : undefined;
    const description = typeof body.description === 'string' ? body.description : (typeof body.memo === 'string' ? body.memo : undefined);

    const result = await createReferralCheckoutSession({
      referralCode: code.trim().toUpperCase(),
      successUrl: typeof successUrl === 'string' ? successUrl : undefined,
      cancelUrl: typeof cancelUrl === 'string' ? cancelUrl : undefined,
      amount,
      currency,
      description,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create checkout' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      url: result.url,
      sessionId: result.sessionId,
      paymentLinkId: result.paymentLinkId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
