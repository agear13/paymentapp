/**
 * Stripe Webhook Endpoint
 * POST /api/stripe/webhook - Handle Stripe webhook events
 * No authentication required (verified by signature)
 * 
 * Sprint 24: Enhanced with edge case handling
 * Beta: Enhanced with correlation IDs and unified payment confirmation
 */

// Force Node.js runtime (required for raw body access)
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { verifyWebhookSignature, isEventProcessed, extractPaymentLinkId } from '@/lib/stripe/webhook';
import { fromSmallestUnit } from '@/lib/stripe/client';
import { prisma } from '@/lib/server/prisma';
import { log } from '@/lib/logger';
import { postStripeSettlement, calculateStripeFee } from '@/lib/ledger/posting-rules/stripe';
import { applyRevenueShareSplits } from '@/lib/referrals/commission-posting';
import { validatePostingBalance } from '@/lib/ledger/balance-validation';
import {
  checkDuplicatePayment,
  validatePaymentAttempt,
  acquirePaymentLock,
  releasePaymentLock,
} from '@/lib/payment/edge-case-handler';
import { generateCorrelationId } from '@/lib/services/correlation';
import { confirmPayment } from '@/lib/services/payment-confirmation';
import Stripe from 'stripe';

/**
 * POST /api/stripe/webhook
 * Process Stripe webhook events
 */
export async function POST(request: NextRequest) {
  // Generate correlation ID for distributed tracing
  const correlationId = generateCorrelationId('stripe', `webhook_${Date.now()}`);
  
  try {
    // Early guard: Check if webhook processing is disabled
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!secret || secret.toLowerCase() === 'disabled') {
      log.warn({ correlationId }, 'Stripe webhook disabled - skipping verification and processing');
      return NextResponse.json({
        received: true,
        processed: false,
        disabled: true,
      });
    }

    // Get the raw body for signature verification
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      log.warn({ correlationId }, 'Missing Stripe signature header');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    const event = await verifyWebhookSignature(body, signature);
    
    if (!event) {
      log.error({ correlationId }, 'Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Update correlation ID with actual event ID
    const eventCorrelationId = generateCorrelationId('stripe', event.id);

    // Check idempotency using new stripe_event_id column
    const existingEvent = await prisma.payment_events.findFirst({
      where: { stripe_event_id: event.id },
    });
    
    if (existingEvent) {
      log.info(
        { 
          correlationId: eventCorrelationId,
          eventId: event.id, 
          eventType: event.type,
          existingPaymentEventId: existingEvent.id,
        },
        'Webhook event already processed (idempotent)'
      );
      return NextResponse.json({ 
        received: true, 
        processed: false,
        duplicate: true,
      });
    }

    log.info({
      correlationId: eventCorrelationId,
      eventId: event.id,
      eventType: event.type,
    }, 'Processing Stripe webhook event');

    // Process different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event, eventCorrelationId);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event, eventCorrelationId);
        break;

      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event, eventCorrelationId);
        break;

      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event, eventCorrelationId);
        break;

      case 'checkout.session.expired':
        await handleCheckoutSessionExpired(event, eventCorrelationId);
        break;

      default:
        log.info(
          { 
            correlationId: eventCorrelationId,
            eventType: event.type 
          },
          'Unhandled webhook event type'
        );
    }

    log.info(
      { 
        correlationId: eventCorrelationId,
        eventId: event.id, 
        eventType: event.type 
      },
      'Webhook event processed successfully'
    );

    return NextResponse.json({ received: true, processed: true });
  } catch (error: any) {
    log.error(
      { 
        correlationId,
        error: error.message,
        stack: error.stack,
      },
      'Failed to process webhook'
    );
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle payment_intent.succeeded event
 * Uses unified confirmPayment() service for idempotent processing
 */
async function handlePaymentIntentSucceeded(event: Stripe.Event, correlationId: string) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const paymentLinkId = extractPaymentLinkId(paymentIntent.metadata);

  if (!paymentLinkId) {
    log.error(
      { 
        correlationId,
        eventId: event.id,
        paymentIntentId: paymentIntent.id 
      },
      'Payment link ID missing from PaymentIntent metadata'
    );
    return;
  }

  log.info({
    correlationId,
    eventId: event.id,
    paymentIntentId: paymentIntent.id,
    paymentLinkId,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
  }, 'Processing payment_intent.succeeded');

  // Convert amount from cents to decimal
  const amountReceived = fromSmallestUnit(paymentIntent.amount_received || paymentIntent.amount, paymentIntent.currency);

  // Use unified payment confirmation service (idempotent)
  const result = await confirmPayment({
    paymentLinkId,
    provider: 'stripe',
    providerRef: event.id,
    paymentIntentId: paymentIntent.id,
    amountReceived,
    currencyReceived: paymentIntent.currency.toUpperCase(),
    correlationId,
    metadata: {
      paymentIntentId: paymentIntent.id,
      stripeStatus: paymentIntent.status,
      payment_method_types: paymentIntent.payment_method_types,
      receipt_email: paymentIntent.receipt_email,
      customer: paymentIntent.customer,
    },
  });

  if (!result.success) {
    log.error({
      correlationId,
      paymentIntentId: paymentIntent.id,
      error: result.error,
    }, 'Payment confirmation failed');
    throw new Error(result.error || 'Payment confirmation failed');
  }

  log.info({
    correlationId,
    paymentEventId: result.paymentEventId,
    alreadyProcessed: result.alreadyProcessed,
  }, 'Payment confirmed successfully via payment_intent.succeeded');
}

/**
 * Handle payment_intent.payment_failed event
 * Beta: Enhanced with correlation IDs
 */
async function handlePaymentIntentFailed(event: Stripe.Event, correlationId: string) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const paymentLinkId = extractPaymentLinkId(paymentIntent.metadata);

  if (!paymentLinkId) {
    log.error(
      { 
        correlationId,
        eventId: event.id,
        paymentIntentId: paymentIntent.id 
      },
      'Payment link ID missing from PaymentIntent metadata'
    );
    return;
  }

  log.info({
    correlationId,
    eventId: event.id,
    paymentIntentId: paymentIntent.id,
    paymentLinkId,
  }, 'Processing payment_intent.payment_failed');

  // Create payment failed event with correlation ID
  await prisma.payment_events.create({
    data: {
      payment_link_id: paymentLinkId,
      event_type: 'PAYMENT_FAILED',
      payment_method: 'STRIPE',
      stripe_event_id: event.id,
      stripe_payment_intent_id: paymentIntent.id,
      correlation_id: correlationId,
      metadata: {
        stripeEventId: event.id,
        stripeStatus: paymentIntent.status,
        lastPaymentError: paymentIntent.last_payment_error,
      },
    },
  });

  log.warn(
    {
      correlationId,
      paymentLinkId,
      paymentIntentId: paymentIntent.id,
      error: paymentIntent.last_payment_error?.message,
    },
    'Payment failed via Stripe'
  );
}

/**
 * Handle payment_intent.canceled event
 */
async function handlePaymentIntentCanceled(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const paymentLinkId = extractPaymentLinkId(paymentIntent.metadata);

  if (!paymentLinkId) {
    return;
  }

  // Create payment event for cancellation
  await prisma.payment_events.create({
    data: {
      payment_link_id: paymentLinkId,
      event_type: 'CANCELED',
      payment_method: 'STRIPE',
      stripe_payment_intent_id: paymentIntent.id,
      metadata: {
        stripeEventId: event.id,
        stripeStatus: paymentIntent.status,
        cancellationReason: paymentIntent.cancellation_reason,
      },
    },
  });

  log.info(
    { paymentLinkId, paymentIntentId: paymentIntent.id },
    'Payment intent canceled'
  );
}

/**
 * Handle checkout.session.completed event
 * Uses unified confirmPayment() service for idempotent processing
 */
async function handleCheckoutSessionCompleted(event: Stripe.Event, correlationId: string) {
  const session = event.data.object as Stripe.Checkout.Session;
  const paymentLinkId = extractPaymentLinkId(session.metadata);

  if (!paymentLinkId) {
    log.error(
      { 
        correlationId,
        sessionId: session.id 
      },
      'Payment link ID missing from Checkout Session metadata'
    );
    return;
  }

  log.info({
    correlationId,
    eventId: event.id,
    sessionId: session.id,
    paymentLinkId,
    amount: session.amount_total,
    currency: session.currency,
    paymentStatus: session.payment_status,
  }, 'Processing checkout.session.completed');

  // Convert amount from cents to decimal
  const amountReceived = session.amount_total ? session.amount_total / 100 : 0;
  
  // Use unified payment confirmation service (idempotent)
  const result = await confirmPayment({
    paymentLinkId,
    provider: 'stripe',
    providerRef: event.id,
    paymentIntentId: session.payment_intent as string,
    checkoutSessionId: session.id,
    amountReceived,
    currencyReceived: session.currency?.toUpperCase() || 'USD',
    correlationId,
    metadata: {
      checkoutSessionId: session.id,
      customerEmail: session.customer_email,
      paymentStatus: session.payment_status,
      sessionMode: session.mode,
      sessionUrl: session.url,
    },
  });

  if (!result.success) {
    log.error({
      correlationId,
      sessionId: session.id,
      error: result.error,
    }, 'Checkout session payment confirmation failed');
    throw new Error(result.error || 'Payment confirmation failed');
  }

  log.info({
    correlationId,
    sessionId: session.id,
    paymentEventId: result.paymentEventId,
    alreadyProcessed: result.alreadyProcessed,
  }, 'Checkout session payment confirmed successfully');

  // Best-effort: apply revenue share splits (commission posting)
  try {
    const amountReceived = session.amount_total ? session.amount_total / 100 : 0;
    const currencyReceived = session.currency?.toUpperCase() || 'USD';
    const orgId = session.metadata?.organization_id;
    if (orgId) {
      const commissionResult = await applyRevenueShareSplits({
        session,
        stripeEventId: event.id,
        paymentLinkId,
        organizationId: orgId,
        grossAmount: amountReceived,
        currency: currencyReceived,
        correlationId: eventCorrelationId,
      });
      if (commissionResult.posted) {
        log.info(
          { correlationId: eventCorrelationId, consultantAmount: commissionResult.consultantAmount, bdPartnerAmount: commissionResult.bdPartnerAmount },
          'Commission posted successfully'
        );
      }
    }
  } catch (commissionErr: any) {
    log.error(
      { correlationId: eventCorrelationId, paymentLinkId, error: commissionErr?.message },
      'Commission posting failed (best-effort, payment confirmed)'
    );
    // Do NOT throw - return 200
  }
}

/**
 * Handle checkout.session.expired event
 */
async function handleCheckoutSessionExpired(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const paymentLinkId = extractPaymentLinkId(session.metadata);

  if (!paymentLinkId) {
    return;
  }

  log.info(
    {
      paymentLinkId,
      sessionId: session.id,
    },
    'Checkout session expired'
  );
}




