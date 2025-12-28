/**
 * Stripe Create Checkout Session API
 * POST /api/stripe/create-checkout-session - Create a Stripe Checkout Session
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe, handleStripeError, toSmallestUnit } from '@/lib/stripe/client';
import { prisma } from '@/lib/prisma';
import { log } from '@/lib/logger';
import { applyRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

// Request validation schema
const createCheckoutSessionSchema = z.object({
  paymentLinkId: z.string().uuid(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

/**
 * POST /api/stripe/create-checkout-session
 * Create a Stripe Checkout Session for hosted payment page
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await applyRateLimit(request, 'public');
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validation = createCheckoutSessionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { paymentLinkId, successUrl, cancelUrl } = validation.data;

    // Fetch payment link with organization and merchant settings
    const paymentLink = await prisma.payment_links.findUnique({
      where: { id: paymentLinkId },
      include: {
        organization: {
          include: {
            merchantSettings: {
              select: {
                stripeAccountId: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    if (!paymentLink) {
      return NextResponse.json(
        { error: 'Payment link not found' },
        { status: 404 }
      );
    }

    // Validate payment link status
    if (paymentLink.status !== 'OPEN') {
      return NextResponse.json(
        { error: `Payment link is ${paymentLink.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    // Check if expired
    if (paymentLink.expiresAt && new Date(paymentLink.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'Payment link has expired' },
        { status: 400 }
      );
    }

    // Verify Stripe is configured for merchant
    const merchantSettings = paymentLink.organization.merchantSettings[0];
    if (!merchantSettings?.stripeAccountId) {
      return NextResponse.json(
        { error: 'Stripe not configured for this merchant' },
        { status: 400 }
      );
    }

    // Calculate amount in smallest currency unit
    const amountInSmallestUnit = toSmallestUnit(
      Number(paymentLink.amount),
      paymentLink.currency
    );

    // Get base URL from environment or request
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    
    // Construct return URLs
    const defaultSuccessUrl = `${baseUrl}/pay/${paymentLink.shortCode}/success?session_id={CHECKOUT_SESSION_ID}`;
    const defaultCancelUrl = `${baseUrl}/pay/${paymentLink.shortCode}`;

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: paymentLink.currency.toLowerCase(),
            product_data: {
              name: paymentLink.description || `Payment for ${paymentLink.shortCode}`,
              description: paymentLink.invoiceReference
                ? `Invoice: ${paymentLink.invoiceReference}`
                : undefined,
            },
            unit_amount: amountInSmallestUnit,
          },
          quantity: 1,
        },
      ],
      metadata: {
        payment_link_id: paymentLinkId,
        organization_id: paymentLink.organizationId,
        short_code: paymentLink.shortCode,
        invoice_reference: paymentLink.invoiceReference || '',
      },
      customer_email: paymentLink.customerEmail || undefined,
      success_url: successUrl || defaultSuccessUrl,
      cancel_url: cancelUrl || defaultCancelUrl,
      expires_at: paymentLink.expiresAt
        ? Math.floor(new Date(paymentLink.expiresAt).getTime() / 1000)
        : Math.floor(Date.now() / 1000) + 86400, // 24 hours default
      payment_intent_data: {
        metadata: {
          payment_link_id: paymentLinkId,
          organization_id: paymentLink.organizationId,
          short_code: paymentLink.shortCode,
        },
      },
    });

    // Create payment event for checkout session created
    await prisma.payment_events.create({
      data: {
        payment_link_id: paymentLinkId,
        event_type: 'PAYMENT_INITIATED',
        payment_method: 'STRIPE',
        metadata: {
          checkoutSessionId: session.id,
          checkoutUrl: session.url,
          amount: amountInSmallestUnit,
          currency: paymentLink.currency,
        },
      },
    });

    log.info(
      {
        paymentLinkId,
        sessionId: session.id,
        amount: amountInSmallestUnit,
        currency: paymentLink.currency,
      },
      'Checkout session created successfully'
    );

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    const stripeError = handleStripeError(error);
    
    log.error(
      { error: stripeError.message },
      'Failed to create Checkout session'
    );

    return NextResponse.json(
      { error: stripeError.message },
      { status: stripeError.statusCode }
    );
  }
}




