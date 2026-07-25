/**
 * Temporary connectivity check for Pinch API credentials.
 * Blocked in production.
 *
 * GET /api/test/pinch
 */

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { PinchApiError, PinchClient } from '@/lib/payments/pinch/client';

const MERCHANT_ENDPOINT = '/merchants';
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

function pinchErrorResponse(error: PinchApiError): NextResponse {
  return NextResponse.json(parseResponseBody(error.body), { status: error.status });
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const client = PinchClient.fromEnv();

    try {
      const merchant = await client.get(MERCHANT_ENDPOINT);
      return NextResponse.json(merchant ?? null);
    } catch (error) {
      if (!(error instanceof PinchApiError)) {
        throw error;
      }

      try {
        const health = await client.get(HEALTH_ENDPOINT);
        return NextResponse.json(health ?? null);
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

    const message = error instanceof Error ? error.message : 'Pinch connectivity check failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
