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
import { verifyWebhookSignature, extractPaymentLinkId } from '@/lib/stripe/webhook';
import { fromSmallestUnit } from '@/lib/stripe/client';
import { prisma } from '@/lib/server/prisma';
import { log } from '@/lib/logger';
import {
  recordStripeWebhookReceived,
  markStripeWebhookProcessing,
  markStripeWebhookOutcome,
  extractStripeLinkage,
} from '@/lib/webhooks/stripe-audit';
import { postStripeSettlement, calculateStripeFee, postStripeRefundReversal } from '@/lib/ledger/posting-rules/stripe';
import { provisionStripeLedgerAccounts } from '@/lib/ledger/ledger-account-provisioner';
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
  const correlationId = generateCorrelationId('stripe', `webhook_${Date.now()}`);
  let webhookEventId: string | null = null;
  let webhookStartMs = 0;

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

    const eventScopedCorrelationId = generateCorrelationId('stripe', event.id);
    const linkage = extractStripeLinkage(event);
    const headersRecord: Record<string, string | undefined> = {};
    for (const key of ['stripe-signature', 'user-agent', 'cf-connecting-ip', 'x-forwarded-for']) {
      const v = headersList.get(key);
      if (v) headersRecord[key] = v;
    }

    const auditResult = await recordStripeWebhookReceived({
      rawBody: body,
      headers: headersRecord,
      parsedStripeEvent: event,
      linkage,
      correlationId: eventScopedCorrelationId,
    });

    if (auditResult.isDuplicate) {
      log.info(
        {
          correlationId: eventScopedCorrelationId,
          webhookEventId: auditResult.row.id,
          providerEventId: auditResult.row.provider_event_id,
          eventType: auditResult.row.event_type,
          attemptCount: auditResult.row.attempt_count,
        },
        'Duplicate webhook delivery; skipping handlers'
      );
      return NextResponse.json({ received: true, processed: false, duplicate: true });
    }

    webhookEventId = auditResult.row.id;
    webhookStartMs = Date.now();
    await markStripeWebhookProcessing(webhookEventId);

    log.info(
      {
        correlationId: eventScopedCorrelationId,
        webhookEventId,
        providerEventId: event.id,
        eventType: event.type,
        attemptCount: auditResult.row.attempt_count + 1,
      },
      'Processing Stripe webhook event'
    );

    const outcome = await processStripeWebhookEvent(event, eventScopedCorrelationId);

    const durationMs = Date.now() - webhookStartMs;
    await markStripeWebhookOutcome({
      id: webhookEventId,
      outcome,
      durationMs,
    });

    log.info(
      {
        correlationId: eventScopedCorrelationId,
        webhookEventId,
        providerEventId: event.id,
        eventType: event.type,
        attemptCount: auditResult.row.attempt_count + 1,
        durationMs,
      },
      'Webhook event processed successfully'
    );

    return NextResponse.json({ received: true, processed: true });
  } catch (error: unknown) {
    const err = error as { message?: string; stack?: string };
    if (webhookEventId) {
      const durationMs = webhookStartMs ? Date.now() - webhookStartMs : undefined;
      try {
        await markStripeWebhookOutcome({
          id: webhookEventId,
          outcome: 'ERROR',
          durationMs,
          errorMessage: err?.message ? `${err.message}${err?.stack ? `\n${err.stack}` : ''}` : undefined,
        });
      } catch (markErr) {
        log.error({ correlationId, markErr }, 'Failed to mark webhook outcome ERROR');
      }
    }
    log.error(
      { correlationId, error: err?.message, stack: err?.stack },
      'Failed to process webhook'
    );
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Run business logic for a Stripe webhook event. Used by POST handler and replay.
 * Returns PROCESSED or IGNORED. Throws on handler errors.
 */
export async function processStripeWebhookEvent(
  event: Stripe.Event,
  correlationId: string
): Promise<'PROCESSED' | 'IGNORED'> {
  let outcome: 'PROCESSED' | 'IGNORED' = 'PROCESSED';

  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(event, correlationId);
      break;

    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(event, correlationId);
      break;

    case 'payment_intent.canceled':
      await handlePaymentIntentCanceled(event, correlationId);
      break;

    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event, correlationId);
      break;

    case 'checkout.session.expired':
      await handleCheckoutSessionExpired(event, correlationId);
      break;

    case 'refund.created':
    case 'refund.updated':
      await handleRefundObjectEvent(event, correlationId);
      break;

    case 'charge.refunded':
      log.info(
        { correlationId, eventId: event.id, eventType: event.type },
        'charge.refunded ignored (refund.* is source of truth; no DB or ledger writes)'
      );
      break;

    default:
      if (
        event.type === 'charge.refund.created' ||
        event.type === 'charge.refund.updated'
      ) {
        await handleRefundObjectEvent(event, correlationId);
      } else {
        outcome = 'IGNORED';
        log.info(
          { correlationId, eventType: event.type },
          'Unhandled webhook event type'
        );
      }
  }

  return outcome;
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
async function handlePaymentIntentCanceled(event: Stripe.Event, _correlationId?: string) {
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

  // Compute once and reuse for confirmPayment and commission posting
  const amountReceived = session.amount_total ? session.amount_total / 100 : 0;
  const currencyReceived = session.currency?.toUpperCase() || 'USD';

  // Use unified payment confirmation service (idempotent)
  const result = await confirmPayment({
    paymentLinkId,
    provider: 'stripe',
    providerRef: event.id,
    paymentIntentId: session.payment_intent as string,
    checkoutSessionId: session.id,
    amountReceived,
    currencyReceived,
    correlationId,
    metadata: {
      checkoutSessionId: session.id,
      customerEmail: session.customer_email,
      paymentStatus: session.payment_status,
      sessionMode: session.mode,
      sessionUrl: session.url,
      ...(session.metadata || {}),
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
    const orgId = session.metadata?.organization_id;
    if (!orgId) {
      log.warn(
        { correlationId, sessionId: session.id },
        'Commission skipped: missing organization_id in session.metadata'
      );
    } else {
      const commissionResult = await applyRevenueShareSplits({
        session,
        stripeEventId: event.id,
        paymentLinkId,
        organizationId: orgId,
        grossAmount: amountReceived,
        currency: currencyReceived,
        correlationId,
      });
      if (commissionResult.posted) {
        log.info(
          { correlationId, consultantAmount: commissionResult.consultantAmount, bdPartnerAmount: commissionResult.bdPartnerAmount },
          'Commission posted successfully'
        );
      } else {
        log.info(
          {
            correlationId,
            paymentLinkId,
            stripeEventId: event.id,
            referralLinkId: session.metadata?.referral_link_id ?? undefined,
          },
          'Commission posting returned posted=false'
        );
      }
    }
  } catch (commissionErr: any) {
    log.error(
      { correlationId, paymentLinkId, error: commissionErr?.message },
      'Commission posting failed (best-effort, payment confirmed)'
    );
    // Do NOT throw - return 200
  }
}

/**
 * Handle checkout.session.expired event
 */
async function handleCheckoutSessionExpired(event: Stripe.Event, _correlationId?: string) {
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

/**
 * Handle Refund object events (refund.created, refund.updated, charge.refund.*).
 * Uses refund.id as stable idempotency key (correlation_id = stripe_refund_${refundId}).
 * Only finalizes when refund.status === 'succeeded'. Does not throw; returns cleanly on skip/unlinkable.
 */
async function handleRefundObjectEvent(event: Stripe.Event, correlationId: string) {
  const obj = event.data.object as unknown;
  if (!obj || (obj as Record<string, unknown>).object !== 'refund') {
    return;
  }
  const refund = obj as Stripe.Refund;
  if (refund.status !== 'succeeded') {
    log.info(
      { correlationId, eventId: event.id, refundId: refund.id, status: refund.status },
      'Refund event skipped: status not succeeded'
    );
    return;
  }

  const refundId = refund.id;
  const piId =
    typeof refund.payment_intent === 'string'
      ? refund.payment_intent
      : (refund.payment_intent as Stripe.PaymentIntent)?.id;
  if (!piId) {
    log.warn({ correlationId, eventId: event.id, refundId }, 'Refund event: missing payment_intent');
    return;
  }
  const amountMinor = typeof refund.amount === 'number' ? refund.amount : 0;
  const currency = (typeof refund.currency === 'string' ? refund.currency : 'usd').toLowerCase();
  const stripeEventId = event.id;

  const paymentEventForLink = await prisma.payment_events.findFirst({
    where: {
      stripe_payment_intent_id: piId,
      event_type: 'PAYMENT_CONFIRMED',
    },
    select: { payment_link_id: true },
    orderBy: { created_at: 'desc' },
  });
  if (!paymentEventForLink) {
    log.warn(
      { correlationId, eventId: event.id, refundId, paymentIntentId: piId },
      'Refund event: no PAYMENT_CONFIRMED for this payment intent'
    );
    return;
  }
  const paymentLinkId = paymentEventForLink.payment_link_id;
  if (!paymentLinkId) {
    log.warn(
      { correlationId, eventId: event.id, refundId, paymentIntentId: piId },
      'Refund event: PAYMENT_CONFIRMED row has no payment_link_id'
    );
    return;
  }
  const refundCorrelationId = `stripe_refund_${refundId}`;

  const existingRefund = await prisma.payment_events.findFirst({
    where: {
      payment_link_id: paymentLinkId,
      event_type: 'REFUND_CONFIRMED',
      correlation_id: refundCorrelationId,
    },
  });
  if (existingRefund) {
    log.info(
      { correlationId, eventId: event.id, refundId, paymentLinkId },
      'Refund already processed (idempotent by refundId)'
    );
    return;
  }

  const amountDollars = fromSmallestUnit(amountMinor, currency);
  const amountDollarsStr = amountDollars.toFixed(2);
  const currencyUpper = currency.toUpperCase();

  const paymentLinkRow = await prisma.payment_links.findUnique({
    where: { id: paymentLinkId },
    select: { organization_id: true },
  });
  if (!paymentLinkRow) {
    log.warn({ correlationId, eventId: event.id, refundId, paymentLinkId }, 'Refund event: payment link not found');
    return;
  }
  const organizationId = paymentLinkRow.organization_id;

  const paidAgg = await prisma.payment_events.aggregate({
    where: { payment_link_id: paymentLinkId, event_type: 'PAYMENT_CONFIRMED' },
    _sum: { amount_received: true },
  });
  const refundAgg = await prisma.payment_events.aggregate({
    where: { payment_link_id: paymentLinkId, event_type: 'REFUND_CONFIRMED' },
    _sum: { amount_received: true },
  });
  const totalPaid = Number(paidAgg._sum?.amount_received ?? 0);
  const totalRefundedBefore = Number(refundAgg._sum?.amount_received ?? 0);
  const totalRefundedAfter = totalRefundedBefore + amountDollars;
  const newStatus: 'PAID' | 'PARTIALLY_REFUNDED' | 'REFUNDED' =
    totalPaid > 0 && totalRefundedAfter >= totalPaid
      ? 'REFUNDED'
      : totalRefundedAfter > 0
        ? 'PARTIALLY_REFUNDED'
        : 'PAID';

  const ledgerKeyBase = refundId ? `stripe-refund-${refundId}` : `stripe-refund-${stripeEventId}`;
  const firstLedgerKey = `${ledgerKeyBase}-0`;
  const ledgerEntryExists =
    (await prisma.ledger_entries.count({ where: { idempotency_key: firstLedgerKey } })) > 0;

  await provisionStripeLedgerAccounts(prisma, organizationId, correlationId);

  await prisma.$transaction(
    async (tx) => {
      await tx.payment_events.create({
        data: {
          payment_link_id: paymentLinkId,
          event_type: 'REFUND_CONFIRMED',
          payment_method: 'STRIPE',
          stripe_event_id: stripeEventId,
          stripe_payment_intent_id: piId,
          amount_received: amountDollars,
          currency_received: currencyUpper,
          correlation_id: refundCorrelationId,
          metadata: {
            refundId,
            refundStatus: refund.status,
            refundEventType: event.type,
          },
        },
      });

      await tx.payment_links.update({
        where: { id: paymentLinkId },
        data: { status: newStatus, updated_at: new Date() },
      });

      await postStripeRefundReversal(
        {
          paymentLinkId,
          organizationId,
          stripePaymentIntentId: piId,
          refundAmountDollars: amountDollarsStr,
          currency: currencyUpper,
          refundId,
          stripeEventId,
          correlationId,
          stripeAccountsProvisioned: true,
          ledgerIdempotencyPrecheck: ledgerEntryExists ? 'exists' : 'absent',
        },
        tx,
      );
    },
    { timeout: 15000 },
  );

  log.info(
    {
      correlationId,
      eventId: event.id,
      refundId,
      paymentLinkId,
      amountDollars: amountDollarsStr,
      eventType: event.type,
    },
    'Refund object event processed: REFUND_CONFIRMED created, ledger reversed, status updated'
  );
}

// charge.refunded is NOT a write path: refund.created / refund.updated are the single source of truth.
// The case 'charge.refunded' above only logs and returns; no handleChargeRefunded() call.




