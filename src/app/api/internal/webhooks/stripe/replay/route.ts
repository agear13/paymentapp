/**
 * Internal replay of a stored Stripe webhook event by provider_event_id.
 * Auth: X-Internal-Admin-Token header must match INTERNAL_ADMIN_TOKEN env.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/server/prisma';
import {
  markStripeWebhookProcessing,
  markStripeWebhookOutcome,
} from '@/lib/webhooks/stripe-audit';
import { processStripeWebhookEvent } from '@/app/api/stripe/webhook/route';
import { generateCorrelationId } from '@/lib/services/correlation';
import Stripe from 'stripe';

const PROVIDER_STRIPE = 'STRIPE';

export async function POST(request: NextRequest) {
  const adminToken = process.env.INTERNAL_ADMIN_TOKEN;
  const headerToken = request.headers.get('x-internal-admin-token');

  if (!adminToken || !headerToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const provided = Buffer.from(headerToken);
  const expected = Buffer.from(adminToken);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { provider_event_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body; expected { provider_event_id: "evt_..." }' },
      { status: 400 }
    );
  }

  const providerEventId = body?.provider_event_id;
  if (!providerEventId || typeof providerEventId !== 'string') {
    return NextResponse.json(
      { error: 'Missing or invalid provider_event_id' },
      { status: 400 }
    );
  }

  const row = await prisma.webhook_events.findFirst({
    where: {
      provider: PROVIDER_STRIPE,
      provider_event_id: providerEventId,
    },
  });

  if (!row) {
    return NextResponse.json(
      { error: 'Webhook event not found', provider_event_id: providerEventId },
      { status: 404 }
    );
  }

  let event: Stripe.Event;
  if (row.parsed_event && typeof row.parsed_event === 'object') {
    event = row.parsed_event as unknown as Stripe.Event;
  } else {
    try {
      const parsed = JSON.parse(row.raw_body) as unknown;
      if (!parsed || typeof (parsed as Stripe.Event).id !== 'string') {
        return NextResponse.json(
          { error: 'Stored raw_body is not a valid Stripe event' },
          { status: 400 }
        );
      }
      event = parsed as Stripe.Event;
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse raw_body as JSON' },
        { status: 400 }
      );
    }
  }

  const correlationId = generateCorrelationId('stripe', `replay_${row.id}`);
  const startMs = Date.now();

  try {
    await markStripeWebhookProcessing(row.id);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'Failed to mark PROCESSING', status: row.status },
      { status: 500 }
    );
  }

  try {
    const outcome = await processStripeWebhookEvent(event, correlationId);
    const durationMs = Date.now() - startMs;
    await markStripeWebhookOutcome({
      id: row.id,
      outcome,
      durationMs,
    });

    const updated = await prisma.webhook_events.findUnique({
      where: { id: row.id },
      select: { status: true, attempt_count: true, last_error: true },
    });

    return NextResponse.json({
      ok: true,
      status: updated?.status ?? outcome,
      attempt_count: updated?.attempt_count ?? row.attempt_count + 1,
      last_error: updated?.last_error ?? null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    const durationMs = Date.now() - startMs;
    await markStripeWebhookOutcome({
      id: row.id,
      outcome: 'ERROR',
      durationMs,
      errorMessage: stack ? `${message}\n${stack}` : message,
    });

    const updated = await prisma.webhook_events.findUnique({
      where: { id: row.id },
      select: { status: true, attempt_count: true, last_error: true },
    });

    return NextResponse.json(
      {
        ok: false,
        status: updated?.status ?? 'ERROR',
        attempt_count: updated?.attempt_count ?? row.attempt_count + 1,
        last_error: updated?.last_error ?? message,
      },
      { status: 500 }
    );
  }
}
