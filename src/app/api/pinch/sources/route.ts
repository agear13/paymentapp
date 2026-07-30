/**
 * Pinch payment source creation — vaults a CaptureJS token via POST /sources.
 * Used by the /dev/pinch sandbox flow. Not for production use until reviewed.
 *
 * POST /api/pinch/sources
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { PinchApiError } from '@/lib/payments/pinch/client';
import { PinchSourceService } from '@/lib/payments/pinch/source-service';

const createSourceSchema = z.object({
  payerId: z.string().min(1),
  token: z.string().min(1),
  sourceType: z.enum(['bank-account', 'credit-card', 'payto-account']),
});

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
  console.error('[pinch-sources]', {
    status: error.status,
    statusText: error.statusText,
    method: error.method,
    url: error.url,
    body: error.body.slice(0, 500),
  });

  return NextResponse.json(
    {
      status: error.status,
      statusText: error.statusText,
      body: parseResponseBody(error.body),
    },
    { status: error.status },
  );
}

export async function POST(request: NextRequest) {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PUBLIC_HACKATHON_JOURNEY_ENABLED !== 'true'
  ) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const auth = await getCurrentUserForApi(request);
  if (!auth.user) return auth.response!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createSourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    console.info('[pinch-sources] Creating source', { payerId: parsed.data.payerId });

    const service = PinchSourceService.fromEnv();
    const source = await service.createSource(parsed.data);

    console.info('[pinch-sources] createSource succeeded', {
      sourceId: source.id,
      sourceType: source.sourceType,
    });

    return NextResponse.json(source);
  } catch (error) {
    if (error instanceof PinchApiError) {
      return pinchErrorResponse(error);
    }

    const message = error instanceof Error ? error.message : 'Pinch source creation failed';
    console.error('[pinch-sources] Unexpected error', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
