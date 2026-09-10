import { createHmac, timingSafeEqual } from 'node:crypto';

/** Reject timestamps older/newer than this window. */
export const AIRWALLEX_WEBHOOK_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Airwallex webhook signature:
 * HMAC-SHA256 hex of (`x-timestamp` + rawBody) with the per-URL secret.
 */
export function signAirwallexWebhook(timestamp: string, rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(`${timestamp}${rawBody}`, 'utf8').digest('hex');
}

export function verifyAirwallexSignature(input: {
  timestamp?: string | null;
  signature?: string | null;
  rawBody: string;
  secret: string;
  nowMs?: number;
}): boolean {
  const timestamp = input.timestamp?.trim() ?? '';
  const signature = input.signature?.trim() ?? '';
  if (!timestamp || !signature || !input.secret) return false;

  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs)) return false;
  const now = input.nowMs ?? Date.now();
  if (Math.abs(now - timestampMs) > AIRWALLEX_WEBHOOK_TIMESTAMP_TOLERANCE_MS) return false;

  const expected = signAirwallexWebhook(timestamp, input.rawBody, input.secret);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function airwallexWebhookHeaders(headers: Record<string, string | undefined>): {
  timestamp?: string;
  signature?: string;
} {
  return {
    timestamp: headers['x-timestamp'] ?? headers['X-Timestamp'],
    signature: headers['x-signature'] ?? headers['X-Signature'],
  };
}
