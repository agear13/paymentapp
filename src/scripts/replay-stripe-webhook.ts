/**
 * Replay a stored Stripe webhook event by provider_event_id.
 * Reads from webhook_events, runs the same business logic as the webhook POST, and updates outcome.
 *
 * Usage:
 *   npx tsx src/scripts/replay-stripe-webhook.ts evt_xxxx
 *   INTERNAL_ADMIN_TOKEN is not required for the script (unlike the API replay route).
 */

import { prisma } from '@/lib/server/prisma';
import {
  markStripeWebhookProcessing,
  markStripeWebhookOutcome,
} from '@/lib/webhooks/stripe-audit';
import { processStripeWebhookEvent } from '@/app/api/stripe/webhook/route';
import { generateCorrelationId } from '@/lib/services/correlation';
import Stripe from 'stripe';

const PROVIDER_STRIPE = 'STRIPE';

async function main() {
  const providerEventId = process.argv[2];
  if (!providerEventId?.startsWith('evt_')) {
    console.error('Usage: npx tsx src/scripts/replay-stripe-webhook.ts evt_xxxx');
    process.exit(1);
  }

  const row = await prisma.webhook_events.findFirst({
    where: {
      provider: PROVIDER_STRIPE,
      provider_event_id: providerEventId,
    },
  });

  if (!row) {
    console.error('Webhook event not found:', providerEventId);
    process.exit(1);
  }

  let event: Stripe.Event;
  if (row.parsed_event && typeof row.parsed_event === 'object') {
    event = row.parsed_event as unknown as Stripe.Event;
  } else {
    try {
      const parsed = JSON.parse(row.raw_body) as unknown;
      if (!parsed || typeof (parsed as Stripe.Event).id !== 'string') {
        console.error('Stored raw_body is not a valid Stripe event');
        process.exit(1);
      }
      event = parsed as Stripe.Event;
    } catch {
      console.error('Failed to parse raw_body as JSON');
      process.exit(1);
    }
  }

  const correlationId = generateCorrelationId('stripe', `replay_${row.id}`);
  const startMs = Date.now();

  await markStripeWebhookProcessing(row.id);

  try {
    const outcome = await processStripeWebhookEvent(event, correlationId);
    const durationMs = Date.now() - startMs;
    await markStripeWebhookOutcome({
      id: row.id,
      outcome,
      durationMs,
    });
    console.log({
      ok: true,
      id: row.id,
      provider_event_id: providerEventId,
      outcome,
      durationMs,
      attempt_count: row.attempt_count + 1,
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
    console.error({ ok: false, id: row.id, error: message });
    process.exit(1);
  }
}

main();
