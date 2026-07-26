/**
 * Pinch scheduled payment creation — used by the /dev/pinch sandbox flow.
 *
 * POST /api/pinch/payments
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PinchApiError } from '@/lib/payments/pinch/client';
import { PinchPaymentService } from '@/lib/payments/pinch/payment-service';

const createPaymentSchema = z.object({
  payerId: z.string().min(1),
  sourceId: z.string().min(1),
  amount: z.number().int().positive(),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1).max(1000),
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
  console.error('[pinch-payments]', {
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
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    console.info('[pinch-payments] Creating payment', {
      payerId: parsed.data.payerId,
      sourceId: parsed.data.sourceId,
      amount: parsed.data.amount,
    });

    const service = PinchPaymentService.fromEnv();
    const payment = await service.createPayment(parsed.data);

    console.info('[pinch-payments] createPayment succeeded', {
      paymentId: payment.id,
      status: payment.status,
    });

    return NextResponse.json(payment);
  } catch (error) {
    if (error instanceof PinchApiError) {
      return pinchErrorResponse(error);
    }

    const message = error instanceof Error ? error.message : 'Pinch payment creation failed';
    console.error('[pinch-payments] Unexpected error', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
