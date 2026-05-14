import { NextRequest, NextResponse } from 'next/server';
import { createReferralServiceCheckoutSession } from '@/lib/referrals/referral-checkout';
import { applyRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const BodySchema = z.object({
  organizationServiceId: z.string().uuid(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

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
    const referralCode = code?.trim()?.toUpperCase() || '';
    if (!referralCode) {
      return NextResponse.json({ error: 'Referral code is required' }, { status: 400 });
    }

    const raw = await request.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await createReferralServiceCheckoutSession({
      referralCode,
      organizationServiceId: parsed.data.organizationServiceId,
      successUrl: parsed.data.successUrl,
      cancelUrl: parsed.data.cancelUrl,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to create checkout' }, { status: 400 });
    }

    return NextResponse.json({
      url: result.url,
      sessionId: result.sessionId,
      paymentLinkId: result.paymentLinkId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
