/**
 * Test-only endpoint: validate refund atomicity
 * Blocked in production (NODE_ENV === 'production').
 *
 * POST /api/test/refund-atomicity
 * (No body required — seeds its own org, payment link, and PAYMENT_CONFIRMED row.)
 *
 * Modes:
 * - Normal (default): builds a synthetic refund.created event and calls
 *   processStripeWebhookEvent — verifies REFUND_CONFIRMED event and ledger
 *   entries are written.
 * - TEST_LEDGER_FAILURE=refund: runs the same DB writes as handleRefundObjectEvent
 *   but throws before the ledger write, then queries to confirm full rollback.
 */

export const runtime = 'nodejs';

import * as crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { generateCorrelationId } from '@/lib/services/correlation';
import { processStripeWebhookEvent } from '@/app/api/stripe/webhook/route';
import Stripe from 'stripe';

/** Unique 8-char payment link short_code (DB constraint). */
function shortCodeFromUuid(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}

export async function POST(request: NextRequest) {
  void request;
  console.log('START refund test');
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    const testPaymentLinkId = crypto.randomUUID();
    const testRefundId = crypto.randomUUID();
    const now = new Date();
    const refundCorrelationId = `stripe_refund_${testRefundId}`;

    const testOrgId = crypto.randomUUID();
    const piId = `pi_test_${crypto.randomUUID().replace(/-/g, '')}`;
    const shortCode = shortCodeFromUuid();

    await prisma.organizations.create({
      data: {
        id: testOrgId,
        clerk_org_id: `refund_atomicity_test_${crypto.randomUUID()}`,
        name: 'Refund atomicity test org',
        created_at: now,
      },
    });

    await prisma.payment_links.create({
      data: {
        id: testPaymentLinkId,
        organization_id: testOrgId,
        short_code: shortCode,
        status: 'PAID',
        payment_method: 'STRIPE',
        amount: 10,
        currency: 'USD',
        invoice_currency: 'USD',
        description: 'Refund atomicity test payment link',
        created_at: now,
        updated_at: now,
      },
    });

    await prisma.payment_events.create({
      data: {
        id: crypto.randomUUID(),
        payment_link_id: testPaymentLinkId,
        organization_id: testOrgId,
        event_type: 'PAYMENT_CONFIRMED',
        payment_method: 'STRIPE',
        stripe_payment_intent_id: piId,
        amount_received: 10,
        currency_received: 'USD',
        created_at: now,
      },
    });

    const testEventId = `evt_test_${crypto.randomUUID().replace(/-/g, '')}`;
    const correlationId = generateCorrelationId('stripe', `test_refund_${testRefundId}`);
    const simulateLedgerFailure = process.env.TEST_LEDGER_FAILURE === 'refund';

    const currency = 'usd';
    const amountMinor = 1000;
    const amountDollars = amountMinor / 100;
    const currencyUpper = currency.toUpperCase();

    if (simulateLedgerFailure) {
      console.log('Calling ledger failure simulation...');
      const result = await runLedgerFailureSimulation({
        testPaymentLinkId,
        testRefundId,
        testEventId,
        correlationId,
        piId,
        amountDollars,
        currencyUpper,
        refundCorrelationId,
      });
      console.log('Returning response');
      return result;
    }

    const syntheticRefund = {
      id: testRefundId,
      object: 'refund',
      status: 'succeeded',
      payment_intent: piId,
      amount: amountMinor,
      currency,
      created: Math.floor(Date.now() / 1000),
    } as unknown as Stripe.Refund;

    const syntheticEvent = {
      id: testEventId,
      object: 'event',
      type: 'refund.created',
      data: { object: syntheticRefund as unknown as Stripe.Event.Data['object'] },
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      pending_webhooks: 0,
      request: null,
      api_version: '2023-10-16',
    } as unknown as Stripe.Event;

    console.log('Calling refund logic...');
    let processingError: string | null = null;
    try {
      await processStripeWebhookEvent(syntheticEvent, correlationId);
    } catch (err: unknown) {
      processingError = err instanceof Error ? err.message : String(err);
      console.error('processStripeWebhookEvent threw:', processingError);
    }

    console.log('Refund complete, running checks...');
    const checks = await buildChecks(testPaymentLinkId, testRefundId);
    const passed = !processingError && checks.refundEventExists && checks.ledgerEntriesExist;

    console.log('Returning response');
    return NextResponse.json({
      success: passed,
      testPaymentLinkId,
      testRefundId,
      checks,
      verdict: passed
        ? 'PASS — refund processed and ledger updated atomically'
        : processingError
          ? `FAIL — processing error: ${processingError}`
          : 'FAIL — missing DB records after processing',
      mode: 'normal',
      refundCorrelationId,
      processingError,
      testEventId,
      correlationId,
    });
  } catch (error: unknown) {
    console.error('Refund atomicity test failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

async function runLedgerFailureSimulation(params: {
  testPaymentLinkId: string;
  testRefundId: string;
  testEventId: string;
  correlationId: string;
  piId: string;
  amountDollars: number;
  currencyUpper: string;
  refundCorrelationId: string;
}): Promise<NextResponse> {
  const {
    testPaymentLinkId,
    testRefundId,
    testEventId,
    correlationId,
    piId,
    amountDollars,
    currencyUpper,
    refundCorrelationId,
  } = params;

  let rolledBack = false;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.payment_events.create({
        data: {
          payment_link_id: testPaymentLinkId,
          event_type: 'REFUND_CONFIRMED',
          payment_method: 'STRIPE',
          stripe_event_id: testEventId,
          stripe_payment_intent_id: piId,
          amount_received: amountDollars,
          currency_received: currencyUpper,
          correlation_id: refundCorrelationId,
          metadata: {
            refundId: testRefundId,
            refundStatus: 'succeeded',
            refundEventType: 'refund.created',
            testMode: true,
          },
        },
      });

      const paidAgg = await tx.payment_events.aggregate({
        where: { payment_link_id: testPaymentLinkId, event_type: 'PAYMENT_CONFIRMED' },
        _sum: { amount_received: true },
      });
      const refundAgg = await tx.payment_events.aggregate({
        where: { payment_link_id: testPaymentLinkId, event_type: 'REFUND_CONFIRMED' },
        _sum: { amount_received: true },
      });
      const totalPaid = Number(paidAgg._sum?.amount_received ?? 0);
      const totalRefunded = Number(refundAgg._sum?.amount_received ?? 0);
      const newStatus: 'PAID' | 'PARTIALLY_REFUNDED' | 'REFUNDED' =
        totalPaid > 0 && totalRefunded >= totalPaid
          ? 'REFUNDED'
          : totalRefunded > 0
            ? 'PARTIALLY_REFUNDED'
            : 'PAID';

      await tx.payment_links.update({
        where: { id: testPaymentLinkId },
        data: { status: newStatus, updated_at: new Date() },
      });

      throw new Error('[TEST] Simulated ledger failure — verifying atomicity rollback');
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith('[TEST]')) {
      rolledBack = true;
    } else {
      throw err;
    }
  }

  console.log('Refund complete, running checks...');
  const checks = await buildChecks(testPaymentLinkId, testRefundId);
  const passed = rolledBack && !checks.refundEventExists && !checks.ledgerEntriesExist;

  return NextResponse.json({
    success: passed,
    testPaymentLinkId,
    testRefundId,
    checks,
    verdict: passed
      ? 'PASS — transaction rolled back cleanly; no orphaned records'
      : !rolledBack
        ? 'FAIL — exception was not the expected test error'
        : 'FAIL — orphaned records found after rollback',
    mode: 'simulate_ledger_failure',
    refundCorrelationId,
    rolledBack,
    testEventId,
    correlationId,
  });
}

async function buildChecks(testPaymentLinkId: string, testRefundId: string) {
  const ledgerKeyPrefix = `stripe-refund-${testRefundId}`;

  const paymentLink = await prisma.payment_links.findUnique({
    where: { id: testPaymentLinkId },
    select: { status: true },
  });

  const refundEvent = await prisma.payment_events.findFirst({
    where: {
      payment_link_id: testPaymentLinkId,
      event_type: 'REFUND_CONFIRMED',
    },
    select: { id: true, event_type: true, correlation_id: true, amount_received: true },
  });

  const ledgerEntries = await prisma.ledger_entries.findMany({
    where: {
      idempotency_key: {
        startsWith: ledgerKeyPrefix,
      },
    },
    select: { id: true, idempotency_key: true, entry_type: true },
  });

  return {
    paymentLinkStatus: paymentLink?.status ?? null,
    refundEventExists: refundEvent !== null,
    refundEventDetails: refundEvent,
    ledgerEntriesExist: ledgerEntries.length > 0,
    ledgerEntryCount: ledgerEntries.length,
    ledgerEntryDetails: ledgerEntries,
  };
}
