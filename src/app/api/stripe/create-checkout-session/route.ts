/**
 * Stripe Create Checkout Session API
 * POST /api/stripe/create-checkout-session - Create or reuse a single active Checkout Session
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleStripeError } from '@/lib/stripe/client';
import { log } from '@/lib/logger';
import { applyRateLimit } from '@/lib/rate-limit';
import { getBrandedAppOrigin, resolveRequestOrigin } from '@/lib/runtime/customer-facing-url';
import {
  CheckoutCoordinatorError,
  resolveOrCreateStripeCheckoutSession,
} from '@/lib/stripe/checkout-session-coordinator.server';
import { z } from 'zod';

const createCheckoutSessionSchema = z.object({
  paymentLinkId: z.string().uuid(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'public');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = await request.json();
    const validation = createCheckoutSessionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { paymentLinkId, successUrl, cancelUrl } = validation.data;
    const baseUrl = getBrandedAppOrigin(resolveRequestOrigin(request));

    const result = await resolveOrCreateStripeCheckoutSession({
      paymentLinkId,
      baseUrl,
      successUrl,
      cancelUrl,
    });

    return NextResponse.json({
      sessionId: result.sessionId,
      url: result.url,
      reused: result.reused,
    });
  } catch (error: unknown) {
    if (error instanceof CheckoutCoordinatorError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    const stripeError = handleStripeError(error);
    log.error('Failed to create Checkout session', error instanceof Error ? error : undefined, {
      stripeError: stripeError.message,
    });

    return NextResponse.json({ error: stripeError.message }, { status: stripeError.statusCode });
  }
}
