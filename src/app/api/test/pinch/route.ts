/**
 * TEMPORARY — Pinch API connectivity test
 *
 * Verifies OAuth authentication and read-only API access via PinchClient.
 * Remove before production release.
 *
 * GET /api/test/pinch
 */

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { PinchApiError, PinchClient } from '@/lib/payments/pinch/client';

/** Pinch "Get Merchant" — read-only profile for the authenticated application. */
const MERCHANT_ENDPOINT = '/merchants';

/** Pinch auth token health check — lightweight fallback if merchant is unavailable. */
const HEALTH_ENDPOINT = '/health/auth';

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
  console.error('[pinch-connectivity-test]', context, {
    status: error.status,
    statusText: error.statusText,
    method: error.method,
    url: error.url,
    body: error.body.slice(0, 500),
  });
}

function pinchErrorResponse(error: PinchApiError): NextResponse {
  logPinchFailure('Pinch API request failed', error);

  return NextResponse.json(
    {
      error: 'Pinch connectivity test failed',
      pinch: {
        status: error.status,
        statusText: error.statusText,
        body: parseResponseBody(error.body),
      },
    },
    { status: error.status },
  );
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Pinch connectivity test is not available in production' }, { status: 403 });
  }

  try {
    const client = PinchClient.fromEnv();

    try {
      const merchant = await client.get(MERCHANT_ENDPOINT);
      console.info('[pinch-connectivity-test] GET /merchants succeeded');
      return NextResponse.json({
        endpoint: MERCHANT_ENDPOINT,
        data: merchant ?? null,
      });
    } catch (error) {
      if (!(error instanceof PinchApiError)) {
        throw error;
      }

      logPinchFailure('GET /merchants failed; trying /health/auth', error);

      try {
        const health = await client.get(HEALTH_ENDPOINT);
        console.info('[pinch-connectivity-test] GET /health/auth succeeded (merchant fallback)');
        return NextResponse.json({
          endpoint: HEALTH_ENDPOINT,
          fallbackFrom: MERCHANT_ENDPOINT,
          data: health ?? null,
        });
      } catch (healthError) {
        if (healthError instanceof PinchApiError) {
          return pinchErrorResponse(healthError);
        }
        throw healthError;
      }
    }
  } catch (error) {
    if (error instanceof PinchApiError) {
      return pinchErrorResponse(error);
    }

    const message = error instanceof Error ? error.message : 'Pinch connectivity test failed';
    console.error('[pinch-connectivity-test] Unexpected error', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
