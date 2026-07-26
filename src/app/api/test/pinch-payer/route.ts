/**
 * TEMPORARY — Pinch createPayer end-to-end test
 *
 * Creates a sandbox payer via PinchPayerService using sample test data.
 * Development only — remove before production release.
 *
 * POST /api/test/pinch-payer
 */

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { PinchApiError } from '@/lib/payments/pinch/client';
import { PinchPayerService } from '@/lib/payments/pinch/payer-service';

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
  console.error('[pinch-payer-test]', context, {
    status: error.status,
    statusText: error.statusText,
    method: error.method,
    url: error.url,
    body: error.body.slice(0, 500),
  });
}

function pinchErrorResponse(error: PinchApiError): NextResponse {
  logPinchFailure('createPayer failed', error);

  return NextResponse.json(
    {
      status: error.status,
      statusText: error.statusText,
      body: parseResponseBody(error.body),
    },
    { status: error.status },
  );
}

function buildSandboxPayerRequest() {
  const suffix = Date.now();

  return {
    firstName: 'Jane',
    lastName: 'Smith',
    emailAddress: `pinch.sandbox.test+${suffix}@mailinator.com`,
    mobileNumber: '0400000000',
    metadata: JSON.stringify({ source: 'pinch-payer-test', createdAt: new Date().toISOString() }),
  };
}

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Pinch payer test is not available in production' },
      { status: 403 },
    );
  }

  const request = buildSandboxPayerRequest();

  try {
    console.info('[pinch-payer-test] Creating sandbox payer', {
      firstName: request.firstName,
      lastName: request.lastName,
      emailAddress: request.emailAddress,
    });

    const service = PinchPayerService.fromEnv();
    const payer = await service.createPayer(request);

    console.info('[pinch-payer-test] createPayer succeeded', {
      payerId: payer.id,
      emailAddress: payer.emailAddress,
    });

    return NextResponse.json(payer);
  } catch (error) {
    if (error instanceof PinchApiError) {
      return pinchErrorResponse(error);
    }

    const message = error instanceof Error ? error.message : 'Pinch payer test failed';
    console.error('[pinch-payer-test] Unexpected error', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
