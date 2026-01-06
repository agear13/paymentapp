/**
 * Stripe Webhook Endpoint
 * POST /api/stripe/webhook - Handle Stripe webhook events
 * No authentication required (verified by signature)
 * 
 * Sprint 24: Enhanced with edge case handling
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
import { validatePostingBalance } from '@/lib/ledger/balance-validation';
import {
  checkDuplicatePayment,
  validatePaymentAttempt,
  acquirePaymentLock,
  releasePaymentLock,
} from '@/lib/payment/edge-case-handler';
import Stripe from 'stripe';

/**
 * POST /api/stripe/webhook
 * Process Stripe webhook events
 */
export async function POST(request: NextRequest) {
  try {
    // Early guard: Check if webhook processing is disabled
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!secret || secret.toLowerCase() === 'disabled') {
      log.warn('Stripe webhook disabled - skipping verification and processing');
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
      log.warn('Missing Stripe signature header');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    const event = await verifyWebhookSignature(body, signature);
    
    if (!event) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Check idempotency - prevent duplicate processing
    const alreadyProcessed = await isEventProcessed(event.id, prisma);
    
    if (alreadyProcessed) {
      log.info(
        { eventId: event.id, eventType: event.type },
        'Webhook event already processed'
      );
      return NextResponse.json({ received: true, processed: false });
    }

    // Process different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event);
        break;

      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event);
        break;

      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event);
        break;

      case 'checkout.session.expired':
        await handleCheckoutSessionExpired(event);
        break;

      default:
        log.info(
          { eventType: event.type },
          'Unhandled webhook event type'
        );
    }

    log.info(
      { eventId: event.id, eventType: event.type },
      'Webhook event processed successfully'
    );

    return NextResponse.json({ received: true, processed: true });
  } catch (error: any) {
    log.error(
      { error: error.message },
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
 * Sprint 24: Enhanced with duplicate detection and locking
 */
async function handlePaymentIntentSucceeded(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const paymentLinkId = extractPaymentLinkId(paymentIntent.metadata);

  if (!paymentLinkId) {
    log.error(
      { paymentIntentId: paymentIntent.id },
      'Payment link ID missing from PaymentIntent metadata'
    );
    return;
  }

  // Sprint 24: Check for duplicate payment
  const duplicateCheck = await checkDuplicatePayment(
    paymentLinkId,
    paymentIntent.id,
    'STRIPE'
  );

  if (duplicateCheck.isDuplicate) {
    log.warn(
      {
        paymentLinkId,
        paymentIntentId: paymentIntent.id,
        existingEventId: duplicateCheck.existingPaymentEventId,
      },
      'Duplicate Stripe payment detected - skipping'
    );
    return; // Already processed
  }

  // Sprint 24: Validate payment attempt
  const attemptValidation = await validatePaymentAttempt(paymentLinkId, false);
  
  if (!attemptValidation.allowed) {
    log.warn(
      {
        paymentLinkId,
        paymentIntentId: paymentIntent.id,
        reason: attemptValidation.reason,
        status: attemptValidation.currentStatus,
      },
      'Stripe payment attempt not allowed'
    );
    return; // Don't process
  }

  // Sprint 24: Acquire lock
  const lockAcquired = await acquirePaymentLock(paymentLinkId);
  
  if (!lockAcquired) {
    log.warn(
      { paymentLinkId, paymentIntentId: paymentIntent.id },
      'Could not acquire payment lock for Stripe payment'
    );
    return; // Let Stripe retry
  }

  try {
    // Get payment link for organization ID
    const paymentLink = await prisma.payment_links.findUnique({
      where: { id: paymentLinkId },
      select: { organization_id: true, currency: true, status: true },
    });

    if (!paymentLink) {
      log.error({ paymentLinkId }, 'Payment link not found');
      return;
    }

    // Double-check not already paid
    if (paymentLink.status === 'PAID') {
      log.info({ paymentLinkId }, 'Payment link already paid');
      return;
    }

    // Update payment link and create event in transaction
    await prisma.$transaction([
      // Update payment link status
      prisma.payment_links.update({
        where: { id: paymentLinkId },
        data: { status: 'PAID', updated_at: new Date() },
      }),
      // Create payment event
      prisma.payment_events.create({
        data: {
          payment_link_id: paymentLinkId,
          event_type: 'PAYMENT_CONFIRMED',
          payment_method: 'STRIPE',
          stripe_payment_intent_id: paymentIntent.id,
          amount_received: fromSmallestUnit(
            paymentIntent.amount_received,
            paymentIntent.currency
          ),
          currency_received: paymentIntent.currency.toUpperCase(),
          metadata: {
            stripeEventId: event.id,
            stripeStatus: paymentIntent.status,
            paymentMethodTypes: paymentIntent.payment_method_types,
            receiptEmail: paymentIntent.receipt_email,
          },
        },
      }),
    ]);

    log.info(
      {
        paymentLinkId,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount_received,
        currency: paymentIntent.currency,
      },
      'Payment confirmed via Stripe'
    );

    // Post to ledger
    try {
      const grossAmount = fromSmallestUnit(
        paymentIntent.amount_received,
        paymentIntent.currency
      ).toString();
      const feeAmount = calculateStripeFee(
        paymentIntent.amount_received,
        paymentIntent.currency
      );

      await postStripeSettlement({
        paymentLinkId,
        organizationId: paymentLink.organization_id,
        stripePaymentIntentId: paymentIntent.id,
        grossAmount,
        feeAmount,
        currency: paymentIntent.currency.toUpperCase(),
      });

      // Validate balance
      await validatePostingBalance(paymentLinkId);

      log.info(
        {
          paymentLinkId,
          paymentIntentId: paymentIntent.id,
          grossAmount,
          feeAmount,
        },
        'Stripe settlement posted to ledger'
      );

      // Queue Xero sync (Sprint 13)
      try {
        const { queueXeroSync } = await import('@/lib/xero/queue-service');
        await queueXeroSync({
          paymentLinkId,
          organizationId: paymentLink.organization_id,
        });
        log.info({ paymentLinkId }, 'Xero sync queued successfully');
      } catch (queueError: any) {
        log.error(
          {
            paymentLinkId,
            error: queueError.message,
          },
          'Failed to queue Xero sync - will retry later'
        );
        // Don't throw - payment is confirmed, sync can be retried manually
      }
    } catch (error: any) {
      log.error(
      {
        paymentLinkId,
        paymentIntentId: paymentIntent.id,
        error: error.message,
      },
      'Failed to post Stripe settlement to ledger'
    );
      // Don't throw - payment is still confirmed
    }
  } finally {
    // Sprint 24: Always release the lock
    await releasePaymentLock(paymentLinkId);
  }
}

/**
 * Handle payment_intent.payment_failed event
 */
async function handlePaymentIntentFailed(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const paymentLinkId = extractPaymentLinkId(paymentIntent.metadata);

  if (!paymentLinkId) {
    log.error(
      { paymentIntentId: paymentIntent.id },
      'Payment link ID missing from PaymentIntent metadata'
    );
    return;
  }

  // Create payment failed event
  await prisma.payment_events.create({
    data: {
      payment_link_id: paymentLinkId,
      event_type: 'PAYMENT_FAILED',
      payment_method: 'STRIPE',
      stripe_payment_intent_id: paymentIntent.id,
      metadata: {
        stripeEventId: event.id,
        stripeStatus: paymentIntent.status,
        lastPaymentError: paymentIntent.last_payment_error,
      },
    },
  });

  log.warn(
    {
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
 */
async function handleCheckoutSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const paymentLinkId = extractPaymentLinkId(session.metadata);

  if (!paymentLinkId) {
    log.error(
      { sessionId: session.id },
      'Payment link ID missing from Checkout Session metadata'
    );
    return;
  }

  // Get payment link for organization ID
  const paymentLink = await prisma.payment_links.findUnique({
    where: { id: paymentLinkId },
    select: { organization_id: true },
  });

  if (!paymentLink) {
    log.error({ paymentLinkId }, 'Payment link not found');
    return;
  }

  // Update payment link and create event in transaction
  await prisma.$transaction([
    // Update payment link status
    prisma.payment_links.update({
      where: { id: paymentLinkId },
      data: {
        status: 'PAID',
        updated_at: new Date(),
      },
    }),
    // Create checkout completed event
    prisma.payment_events.create({
      data: {
        payment_link_id: paymentLinkId,
        event_type: 'PAYMENT_CONFIRMED',
        payment_method: 'STRIPE',
        stripe_payment_intent_id: session.payment_intent as string,
        amount_received: session.amount_total ? session.amount_total / 100 : 0,
        currency_received: session.currency?.toUpperCase() || 'USD',
        metadata: {
          stripeEventId: event.id,
          checkoutSessionId: session.id,
          customerEmail: session.customer_email,
          paymentStatus: session.payment_status,
        },
      },
    }),
  ]);

  log.info(
    {
      paymentLinkId,
      sessionId: session.id,
      paymentIntentId: session.payment_intent,
      amount: session.amount_total,
      currency: session.currency,
      customerEmail: session.customer_email,
    },
    'Checkout session completed and payment confirmed'
  );

  // Post to ledger
  try {
    const grossAmount = session.amount_total ? (session.amount_total / 100).toString() : '0';
    const feeAmount = calculateStripeFee(
      session.amount_total || 0,
      session.currency || 'USD'
    );

    await postStripeSettlement({
      paymentLinkId,
      organizationId: paymentLink.organization_id,
      stripePaymentIntentId: session.payment_intent as string,
      grossAmount,
      feeAmount,
      currency: session.currency?.toUpperCase() || 'USD',
    });

    // Validate balance
    await validatePostingBalance(paymentLinkId);

    log.info(
      {
        paymentLinkId,
        sessionId: session.id,
        grossAmount,
        feeAmount,
      },
      'Stripe checkout settlement posted to ledger'
    );

    // Queue Xero sync (Sprint 13)
    try {
      const { queueXeroSync } = await import('@/lib/xero/queue-service');
      await queueXeroSync({
        paymentLinkId,
        organizationId: paymentLink.organization_id,
      });
      log.info({ paymentLinkId }, 'Xero sync queued successfully');
    } catch (queueError: any) {
      log.error(
        {
          paymentLinkId,
          error: queueError.message,
        },
        'Failed to queue Xero sync - will retry later'
      );
      // Don't throw - payment is confirmed, sync can be retried manually
    }
  } catch (error: any) {
    log.error(
      {
        paymentLinkId,
        sessionId: session.id,
        error: error.message,
      },
      'Failed to post Stripe checkout settlement to ledger'
    );
    // Don't throw - payment is still confirmed
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




