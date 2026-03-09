/**
 * Stripe webhook audit logging: persist every delivery in webhook_events before business processing.
 * Tracks status (RECEIVED → PROCESSING → PROCESSED | IGNORED | ERROR | DUPLICATE), attempts, and errors.
 */

import { prisma } from '@/lib/server/prisma';
import type { WebhookEventStatus, WebhookProvider } from '@prisma/client';
import type Stripe from 'stripe';

const PROVIDER_STRIPE = 'STRIPE' as const;

/** Headers we allow to store (no PII, no full raw headers) */
const ALLOWLIST_HEADER_KEYS = [
  'stripe-signature',
  'user-agent',
  'cf-connecting-ip',
  'x-forwarded-for',
] as const;

export interface StripeLinkage {
  organization_id: string | null;
  payment_link_id: string | null;
  short_code: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_refund_id: string | null;
}

export interface RecordReceivedParams {
  rawBody: string;
  headers: Record<string, string | undefined>;
  parsedStripeEvent: Stripe.Event;
  linkage: StripeLinkage;
  correlationId: string | null;
}

export interface RecordReceivedResult {
  isDuplicate: boolean;
  row: {
    id: string;
    provider: WebhookProvider;
    provider_event_id: string;
    event_type: string;
    status: WebhookEventStatus;
    attempt_count: number;
  };
}

/**
 * Extract linkage fields from a Stripe event for audit and indexing.
 */
export function extractStripeLinkage(event: Stripe.Event): StripeLinkage {
  const obj = event.data?.object as Record<string, unknown> | undefined;
  const metadata =
    obj && typeof obj.metadata === 'object' && obj.metadata !== null
      ? (obj.metadata as Record<string, string>)
      : undefined;

  let organization_id: string | null = null;
  let payment_link_id: string | null = null;
  let short_code: string | null = null;
  if (metadata) {
    if (typeof metadata.organization_id === 'string') organization_id = metadata.organization_id;
    if (typeof metadata.payment_link_id === 'string') payment_link_id = metadata.payment_link_id;
    if (typeof metadata.short_code === 'string') short_code = metadata.short_code;
  }

  let stripe_payment_intent_id: string | null = null;
  const pi = obj?.payment_intent;
  if (typeof pi === 'string') stripe_payment_intent_id = pi;
  else if (pi && typeof (pi as { id?: string }).id === 'string')
    stripe_payment_intent_id = (pi as { id: string }).id;

  let stripe_charge_id: string | null = null;
  const objId = obj && typeof (obj as { id?: string }).id === 'string' ? (obj as { id: string }).id : null;
  if (objId && (objId.startsWith('ch_') || objId.startsWith('py_'))) stripe_charge_id = objId;

  let stripe_refund_id: string | null = null;
  if (objId && (objId.startsWith('re_') || objId.startsWith('pyr_'))) stripe_refund_id = objId;

  return {
    organization_id,
    payment_link_id,
    short_code,
    stripe_payment_intent_id,
    stripe_charge_id,
    stripe_refund_id,
  };
}

/**
 * Build allowlisted headers object (no secrets, minimal set).
 */
function allowlistHeaders(headers: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ALLOWLIST_HEADER_KEYS) {
    const v = headers[key] ?? headers[key.toLowerCase()];
    if (typeof v === 'string') out[key] = v;
  }
  return out;
}

/**
 * Persist webhook delivery in webhook_events (write-ahead). On duplicate provider_event_id, return existing row.
 */
export async function recordStripeWebhookReceived(
  params: RecordReceivedParams
): Promise<RecordReceivedResult> {
  const { rawBody, headers, parsedStripeEvent: event, linkage, correlationId } = params;
  const eventId = event.id;
  const eventType = event.type;

  const existing = await prisma.webhook_events.findFirst({
    where: {
      provider: PROVIDER_STRIPE,
      provider_event_id: eventId,
    },
  });
  if (existing) {
    return { isDuplicate: true, row: existing };
  }

  try {
    const requestId =
      event.request != null && typeof (event.request as { id?: string }).id === 'string'
        ? (event.request as { id: string }).id
        : null;

    const row = await prisma.webhook_events.create({
      data: {
        provider: PROVIDER_STRIPE,
        provider_event_id: eventId,
        event_type: eventType,
        livemode: event.livemode ?? false,
        api_version: event.api_version ?? null,
        request_id: requestId,
        signature_present: true,
        signature_header: headers['stripe-signature'] ?? headers['Stripe-Signature'] ?? null,
        status: 'RECEIVED',
        attempt_count: 0,
        raw_body: rawBody,
        headers: allowlistHeaders(headers),
        parsed_event: event as unknown as Record<string, unknown>,
        correlation_id: correlationId,
        organization_id: linkage.organization_id,
        payment_link_id: linkage.payment_link_id,
        stripe_payment_intent_id: linkage.stripe_payment_intent_id,
        stripe_charge_id: linkage.stripe_charge_id,
        stripe_refund_id: linkage.stripe_refund_id,
      },
    });
    return { isDuplicate: false, row };
  } catch (err: unknown) {
    const prismaErr = err as { code?: string };
    if (prismaErr?.code === 'P2002') {
      const existingRow = await prisma.webhook_events.findFirst({
        where: { provider: PROVIDER_STRIPE, provider_event_id: eventId },
      });
      if (existingRow) return { isDuplicate: true, row: existingRow };
    }
    throw err;
  }
}

/**
 * Mark webhook as PROCESSING and increment attempt_count.
 */
export async function markStripeWebhookProcessing(id: string): Promise<void> {
  await prisma.webhook_events.update({
    where: { id },
    data: {
      status: 'PROCESSING',
      attempt_count: { increment: 1 },
    },
  });
}

export type WebhookOutcome = 'PROCESSED' | 'IGNORED' | 'ERROR';

export interface MarkOutcomeParams {
  id: string;
  outcome: WebhookOutcome;
  durationMs?: number | null;
  errorMessage?: string | null;
}

/**
 * Mark webhook outcome (PROCESSED, IGNORED, or ERROR). Sets processed_at for PROCESSED/IGNORED; for ERROR sets last_error/last_error_at.
 */
export async function markStripeWebhookOutcome(params: MarkOutcomeParams): Promise<void> {
  const { id, outcome, durationMs, errorMessage } = params;
  const now = new Date();

  if (outcome === 'ERROR') {
    await prisma.webhook_events.update({
      where: { id },
      data: {
        status: 'ERROR',
        last_error: errorMessage ?? null,
        last_error_at: now,
        duration_ms: durationMs ?? null,
        processed_at: now,
      },
    });
    return;
  }

  await prisma.webhook_events.update({
    where: { id },
    data: {
      status: outcome,
      processed_at: now,
      duration_ms: durationMs ?? null,
    },
  });
}
