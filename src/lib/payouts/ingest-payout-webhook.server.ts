import 'server-only';

import type { Prisma, WebhookEventStatus, WebhookProvider } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { executePayoutRelease } from '@/lib/payouts/execute-payout-release.server';
import { getPayoutRailAdapter } from '@/lib/payouts/rails/adapters';
import { webhookProviderForPayoutRail } from '@/lib/payouts/rails/registry';
import type { CanonicalPayoutEvent, PayoutRailId } from '@/lib/payouts/rails/types';
import { isPayoutRailId } from '@/lib/payouts/rails/types';
import { PayoutReleaseError } from '@/lib/payouts/payout-status-transitions';

const TERMINAL_WEBHOOK_STATUSES: ReadonlySet<WebhookEventStatus> = new Set([
  'PROCESSED',
  'IGNORED',
  'DUPLICATE',
]);

export type IngestPayoutWebhookInput = {
  railId: string;
  rawBody: string;
  headers: Record<string, string | undefined>;
  parsed?: unknown;
  livemode?: boolean;
};

export type IngestPayoutWebhookResult = {
  ignored: boolean;
  duplicate: boolean;
  reason?: string;
  webhookEventId: string;
  payoutIds: string[];
  acknowledgement?: { body: string; contentType: string };
};

function allowlistedHeaders(headers: Record<string, string | undefined>): Record<string, string> {
  const keys = [
    'user-agent',
    'x-forwarded-for',
    'stripe-signature',
    'x-signature',
    'x-timestamp',
  ];
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = headers[key] ?? headers[key.toLowerCase()];
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

function parseJsonBody(rawBody: string, parsed?: unknown): unknown {
  if (parsed !== undefined) return parsed;
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return { raw: rawBody };
  }
}

function providerEventId(
  railId: PayoutRailId,
  parsed: unknown,
  rawBody: string,
  adapterEventId?: string | null
): string {
  if (adapterEventId) return adapterEventId;
  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>;
    for (const key of ['id', 'event_id', 'eventId', 'provider_event_id']) {
      if (typeof record[key] === 'string' && record[key]) return record[key];
    }
  }
  return `${railId}:${Buffer.from(rawBody).toString('base64').slice(0, 80)}`;
}

function parsedHasSignature(parsed: unknown, headers: Record<string, string | undefined>): boolean {
  if (headers['stripe-signature'] || headers['x-signature']) return true;
  if (parsed && typeof parsed === 'object') {
    const sign = (parsed as Record<string, unknown>).sign;
    return typeof sign === 'string' && sign.length > 0;
  }
  return false;
}

function eventType(parsed: unknown): string {
  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>;
    if (typeof record.type === 'string') return record.type;
    if (typeof record.event_type === 'string') return record.event_type;
  }
  return 'payout.webhook';
}

async function finishWebhook(
  id: string,
  status: WebhookEventStatus,
  extra?: { lastError?: string; payoutId?: string | null; durationMs?: number }
): Promise<void> {
  await prisma.webhook_events.update({
    where: { id },
    data: {
      status,
      processed_at: new Date(),
      last_error: extra?.lastError,
      last_error_at: extra?.lastError ? new Date() : undefined,
      payout_id: extra?.payoutId ?? undefined,
      duration_ms: extra?.durationMs,
    },
  });
}

/**
 * Canonical outbound webhook path: persist delivery, let the adapter verify and
 * normalize, then apply status only through executePayoutRelease().
 */
export async function ingestPayoutWebhook(
  input: IngestPayoutWebhookInput
): Promise<IngestPayoutWebhookResult> {
  if (!isPayoutRailId(input.railId)) {
    throw new PayoutReleaseError('UNKNOWN_PAYOUT_RAIL', `Unknown payout rail: ${input.railId}`, 404);
  }

  const adapter = getPayoutRailAdapter(input.railId);
  const provider = webhookProviderForPayoutRail(input.railId) as WebhookProvider;
  const parsed = parseJsonBody(input.rawBody, input.parsed);
  const provider_event_id = providerEventId(
    input.railId,
    parsed,
    input.rawBody,
    adapter.webhookEventId?.(parsed, input.rawBody) ?? null
  );
  const acknowledgement = adapter.webhookAcknowledgement?.();
  const started = Date.now();

  const existing = await prisma.webhook_events.findFirst({
    where: { provider, provider_event_id },
  });
  if (existing && TERMINAL_WEBHOOK_STATUSES.has(existing.status)) {
    return {
      ignored: existing.status === 'IGNORED',
      duplicate: true,
      reason: 'duplicate',
      webhookEventId: existing.id,
      payoutIds: existing.payout_id ? [existing.payout_id] : [],
      acknowledgement,
    };
  }

  const row =
    existing ??
    (await prisma.webhook_events.create({
      data: {
        provider,
        provider_event_id,
        event_type: eventType(parsed),
        livemode: input.livemode ?? false,
        signature_present: parsedHasSignature(parsed, input.headers),
        raw_body: input.rawBody,
        headers: allowlistedHeaders(input.headers) as Prisma.InputJsonValue,
        parsed_event: parsed as Prisma.InputJsonValue,
        status: 'RECEIVED',
      },
    }));

  if (!adapter.verifyWebhook) {
    await finishWebhook(row.id, 'IGNORED', {
      lastError: 'Rail does not accept inbound payout webhooks',
      durationMs: Date.now() - started,
    });
    return {
      ignored: true,
      duplicate: false,
      reason: 'rail_does_not_accept_webhooks',
      webhookEventId: row.id,
      payoutIds: [],
    };
  }

  const verified = await adapter.verifyWebhook(input.headers, input.rawBody);
  if (!verified) {
    await finishWebhook(row.id, 'ERROR', {
      lastError: 'Webhook signature verification failed',
      durationMs: Date.now() - started,
    });
    throw new PayoutReleaseError('PAYOUT_WEBHOOK_UNVERIFIED', 'Webhook signature verification failed', 401);
  }

  await prisma.webhook_events.update({
    where: { id: row.id },
    data: { status: 'PROCESSING', attempt_count: { increment: 1 } },
  });

  const normalized = adapter.normalizeWebhook(parsed);
  const events: CanonicalPayoutEvent[] = !normalized
    ? []
    : Array.isArray(normalized)
      ? normalized
      : [normalized];

  if (events.length === 0) {
    await finishWebhook(row.id, 'IGNORED', {
      lastError: 'Adapter did not produce a canonical payout event',
      durationMs: Date.now() - started,
    });
    return {
      ignored: true,
      duplicate: false,
      reason: 'no_canonical_event',
      webhookEventId: row.id,
      payoutIds: [],
      acknowledgement,
    };
  }

  const applied = await executePayoutRelease({ type: 'apply_events', events });
  await finishWebhook(row.id, 'PROCESSED', {
    payoutId: applied.payoutIds[0] ?? null,
    durationMs: Date.now() - started,
  });

  return {
    ignored: false,
    duplicate: false,
    webhookEventId: row.id,
    payoutIds: applied.payoutIds,
    acknowledgement,
  };
}
