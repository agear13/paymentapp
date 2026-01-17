/**
 * Stripe Create Checkout Session API
 * POST /api/stripe/create-checkout-session - Create a Stripe Checkout Session
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { stripe, handleStripeError, toSmallestUnit } from '@/lib/stripe/client';
import { prisma } from '@/lib/server/prisma';
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
        organizations: {
          include: {
            merchant_settings: {
              select: {
                stripe_account_id: true,
                display_name: true,
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
    if (paymentLink.expires_at && new Date(paymentLink.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Payment link has expired' },
        { status: 400 }
      );
    }

    // Verify Stripe is configured for merchant
    const merchantSettings = paymentLink.organizations.merchant_settings[0];
    if (!merchantSettings?.stripe_account_id) {
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
    const defaultSuccessUrl = `${baseUrl}/pay/${paymentLink.short_code}/success?session_id={CHECKOUT_SESSION_ID}`;
    const defaultCancelUrl = `${baseUrl}/pay/${paymentLink.short_code}`;

    // Calculate Stripe session expiry (max 24 hours per Stripe API limits)
    const now = Math.floor(Date.now() / 1000);
    const stripeMaxExpiry = now + 86400; // 24 hours from now
    let sessionExpiresAt = stripeMaxExpiry;
    
    if (paymentLink.expires_at) {
      const linkExpiry = Math.floor(new Date(paymentLink.expires_at).getTime() / 1000);
      sessionExpiresAt = Math.min(linkExpiry, stripeMaxExpiry);
      
      // Log if we're capping the expiry due to Stripe's 24-hour limit
      if (linkExpiry > stripeMaxExpiry) {
        log.info('Stripe session expiry capped at 24 hours', {
          paymentLinkId,
          linkExpiresAt: new Date(linkExpiry * 1000).toISOString(),
          sessionExpiresAt: new Date(sessionExpiresAt * 1000).toISOString(),
          capped: true,
        });
      }
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: paymentLink.currency.toLowerCase(),
            product_data: {
              name: paymentLink.description || `Payment for ${paymentLink.short_code}`,
              description: paymentLink.invoice_reference
                ? `Invoice: ${paymentLink.invoice_reference}`
                : undefined,
            },
            unit_amount: amountInSmallestUnit,
          },
          quantity: 1,
        },
      ],
      metadata: {
        payment_link_id: paymentLinkId,
        organization_id: paymentLink.organization_id,
        short_code: paymentLink.short_code,
        invoice_reference: paymentLink.invoice_reference || '',
      },
      customer_email: paymentLink.customer_email || undefined,
      success_url: successUrl || defaultSuccessUrl,
      cancel_url: cancelUrl || defaultCancelUrl,
      // Stripe checkout sessions must expire within 24 hours (Stripe API limit)
      // Uses minimum of payment link expiry and 24 hours from now
      expires_at: sessionExpiresAt,
      payment_intent_data: {
        metadata: {
          payment_link_id: paymentLinkId,
          organization_id: paymentLink.organization_id,
          short_code: paymentLink.short_code,
        },
      },
    });

    // Create payment event for checkout session created
    await prisma.payment_events.create({
      data: {
        id: randomUUID(),
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
      'Checkout session created successfully',
      {
        paymentLinkId,
        sessionId: session.id,
        amount: amountInSmallestUnit,
        currency: paymentLink.currency,
      }
    );

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    const stripeError = handleStripeError(error);
    
    log.error(
      'Failed to create Checkout session',
      error,
      { stripeError: stripeError.message }
    );

    return NextResponse.json(
      { error: stripeError.message },
      { status: stripeError.statusCode }
    );
  }
}




