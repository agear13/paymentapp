/**
 * Stripe Create PaymentIntent API
 * POST /api/stripe/create-payment-intent - Create a PaymentIntent for payment link
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe, handleStripeError, toSmallestUnit, generateIdempotencyKey } from '@/lib/stripe/client';
import { prisma } from '@/lib/server/prisma';
import { log } from '@/lib/logger';
import { applyRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

// Request validation schema
const createPaymentIntentSchema = z.object({
  paymentLinkId: z.string().uuid(),
});

/**
 * POST /api/stripe/create-payment-intent
 * Create a Stripe PaymentIntent for a payment link
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
    const validation = createPaymentIntentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { paymentLinkId } = validation.data;

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
    const merchantSettings = paymentLink.organizations?.merchant_settings?.[0];
    if (!merchantSettings?.stripe_account_id) {
      if (process.env.NODE_ENV !== 'production') {
        log.warn(
          'Stripe not configured for merchant',
          {
            paymentLinkId,
            organizationId: paymentLink.organization_id,
          }
        );
      }
      return NextResponse.json(
        { error: 'Stripe not configured for this merchant' },
        { status: 400 }
      );
    }

    // Check if PaymentIntent already exists for this payment link
    const existingEvent = await prisma.payment_events.findFirst({
      where: {
        payment_link_id: paymentLinkId,
        event_type: 'PAYMENT_INITIATED',
        payment_method: 'STRIPE',
        stripe_payment_intent_id: { not: null },
      },
      orderBy: { created_at: 'desc' },
    });

    if (existingEvent?.stripe_payment_intent_id) {
      // Return existing PaymentIntent
      try {
        const existingPaymentIntent = await stripe.paymentIntents.retrieve(
          existingEvent.stripe_payment_intent_id
        );

        // Only return if it's still in a usable state
        if (['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(existingPaymentIntent.status)) {
          log.info(
            { paymentLinkId, paymentIntentId: existingPaymentIntent.id },
            'Returning existing PaymentIntent'
          );

          return NextResponse.json({
            clientSecret: existingPaymentIntent.client_secret,
            paymentIntentId: existingPaymentIntent.id,
          });
        }
      } catch (error: any) {
        log.warn(
          { error: error.message, paymentIntentId: existingEvent.stripe_payment_intent_id },
          'Failed to retrieve existing PaymentIntent, creating new one'
        );
      }
    }

    // Calculate amount in smallest currency unit
    const amountInSmallestUnit = toSmallestUnit(
      Number(paymentLink.amount),
      paymentLink.currency
    );

    // Generate idempotency key
    const idempotencyKey = generateIdempotencyKey(paymentLinkId);

    // Create PaymentIntent with retry logic
    let paymentIntent;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        paymentIntent = await stripe.paymentIntents.create(
          {
            amount: amountInSmallestUnit,
            currency: paymentLink.currency.toLowerCase(),
            metadata: {
              payment_link_id: paymentLinkId,
              organization_id: paymentLink.organization_id,
              short_code: paymentLink.short_code,
              invoice_reference: paymentLink.invoice_reference || '',
            },
            description: paymentLink.description || `Payment for ${paymentLink.short_code}`,
            receipt_email: paymentLink.customer_email || undefined,
            automatic_payment_methods: {
              enabled: true,
            },
          },
          {
            idempotencyKey,
          }
        );

        break; // Success, exit retry loop
      } catch (error: any) {
        retryCount++;
        
        if (retryCount >= maxRetries || error.type !== 'StripeConnectionError') {
          throw error; // Give up or non-retryable error
        }

        log.warn(
          { retryCount, error: error.message },
          'Retrying PaymentIntent creation'
        );
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      }
    }

    if (!paymentIntent) {
      throw new Error('Failed to create PaymentIntent after retries');
    }

    // Create payment event
    await prisma.payment_events.create({
      data: {
        payment_link_id: paymentLinkId,
        event_type: 'PAYMENT_INITIATED',
        payment_method: 'STRIPE',
        stripe_payment_intent_id: paymentIntent.id,
        metadata: {
          paymentIntentStatus: paymentIntent.status,
          amount: amountInSmallestUnit,
          currency: paymentLink.currency,
        },
      },
    });

    log.info(
      {
        paymentLinkId,
        paymentIntentId: paymentIntent.id,
        amount: amountInSmallestUnit,
        currency: paymentLink.currency,
      },
      'PaymentIntent created successfully'
    );

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error: any) {
    const stripeError = handleStripeError(error);
    
    log.error(
      'Failed to create PaymentIntent',
      error,
      { stripeError: stripeError.message }
    );

    return NextResponse.json(
      { error: stripeError.message },
      { status: stripeError.statusCode }
    );
  }
}




