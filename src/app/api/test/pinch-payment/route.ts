/**
 * TEMPORARY — Pinch createPayment end-to-end test
 *
 * Verifies PinchPaymentService.createPayment() against the sandbox merchant.
 * Development only — remove before production release.
 *
 * POST /api/test/pinch-payment
 */

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { PinchApiError, PinchClient } from '@/lib/payments/pinch/client';
import { PinchPaymentService } from '@/lib/payments/pinch/payment-service';

const PAYERS_LIST_ENDPOINT = '/payers?page=1&pageSize=1';
const TEST_PAYER_ID_ENV = 'PINCH_TEST_PAYER_ID';

/** Sandbox demo payment — 100 cents ($1.00 AUD). */
const DEMO_AMOUNT_CENTS = 100;

type PinchPayersListResponse = {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  data: Array<{ id: string }>;
};

type ResolvedTestPayer =
  | { payerId: string; source: 'env' | 'api'; totalItems: number }
  | { payerId: null; totalItems: number };

function parseResponseBody(body: string): unknown {
  const trimmed = body.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
}

function logPinchFailure(context: string, error: PinchApiError): void {
  console.error('[pinch-payment-test]', context, {
    status: error.status,
    statusText: error.statusText,
    method: error.method,
    url: error.url,
    body: error.body.slice(0, 500),
  });
}

function pinchErrorResponse(error: PinchApiError): NextResponse {
  logPinchFailure('createPayment failed', error);

  return NextResponse.json(
    {
      status: error.status,
      statusText: error.statusText,
      body: parseResponseBody(error.body),
    },
    { status: error.status },
  );
}

function formatTransactionDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function resolveTestPayer(client: PinchClient): Promise<ResolvedTestPayer> {
  const fromEnv = process.env[TEST_PAYER_ID_ENV]?.trim();
  if (fromEnv) {
    return { payerId: fromEnv, source: 'env', totalItems: -1 };
  }

  const list = await client.get<PinchPayersListResponse>(PAYERS_LIST_ENDPOINT);
  const firstPayer = list.data?.[0];

  if (firstPayer?.id) {
    return { payerId: firstPayer.id, source: 'api', totalItems: list.totalItems };
  }

  return { payerId: null, totalItems: list.totalItems };
}

function missingPayerResponse(totalItems: number): NextResponse {
  console.warn('[pinch-payment-test] Cannot run — no Pinch payer available', {
    totalItems,
    envVar: TEST_PAYER_ID_ENV,
  });

  return NextResponse.json(
    {
      error: 'Pinch payment test cannot run — payer prerequisite missing',
      missingPrerequisite: 'payer',
      explanation: [
        'Pinch POST /payments requires an existing payerId (`pyr_…`).',
        'Every payment must be associated with a Payer under your merchant account (see Pinch API core concepts).',
        'This sandbox merchant currently has no payers — GET /payers returned zero results.',
        'A payer also needs at least one valid payment source (bank account or credit card); otherwise payment creation will fail even with a payerId.',
      ],
      requiredSteps: [
        'Create a payer via POST /payers (firstName, lastName, email, mobile, etc.).',
        'Attach a payment source to that payer (bank account or creditCardToken from the Pinch capture script).',
        `Set ${TEST_PAYER_ID_ENV}=<pyr_…> in .env.local, or ensure GET /payers returns at least one payer.`,
      ],
      documentation: 'https://docs.getpinch.com.au/docs/credit-card-payments',
      merchantPayerCount: totalItems,
    },
    { status: 503 },
  );
}

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Pinch payment test is not available in production' },
      { status: 403 },
    );
  }

  try {
    const client = PinchClient.fromEnv();
    const payer = await resolveTestPayer(client);

    if (!payer.payerId) {
      return missingPayerResponse(payer.totalItems);
    }

    const transactionDate = formatTransactionDate();
    const request = {
      payerId: payer.payerId,
      amount: DEMO_AMOUNT_CENTS,
      transactionDate,
      description: 'Provvypay Pinch sandbox connectivity test',
    };

    console.info('[pinch-payment-test] Creating sandbox payment', {
      payerId: payer.payerId,
      payerSource: payer.source,
      amount: request.amount,
      transactionDate: request.transactionDate,
    });

    const service = PinchPaymentService.fromEnv();
    const payment = await service.createPayment(request);

    console.info('[pinch-payment-test] createPayment succeeded', {
      paymentId: payment.id,
      status: payment.status,
      attemptId: payment.attemptId,
    });

    return NextResponse.json(payment);
  } catch (error) {
    if (error instanceof PinchApiError) {
      return pinchErrorResponse(error);
    }

    const message = error instanceof Error ? error.message : 'Pinch payment test failed';
    console.error('[pinch-payment-test] Unexpected error', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
