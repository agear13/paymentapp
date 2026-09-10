import { createHash } from 'node:crypto';

/**
 * Stable namespace for deriving Airwallex transfer request_id values from
 * Provvy payouts.idempotency_key. Do not send the raw key — it is longer than
 * the conservative Partner API 50-character request_id guidance.
 */
export const AIRWALLEX_REQUEST_ID_NAMESPACE = '7c3f1a90-6b2e-51d4-9c08-2e4a7b1f0c33';

function uuidToBytes(uuid: string): Buffer {
  const hex = uuid.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(hex)) {
    throw new Error('Airwallex request_id namespace must be a UUID');
  }
  return Buffer.from(hex, 'hex');
}

export function uuidV5(name: string, namespace: string): string {
  const hash = createHash('sha1').update(uuidToBytes(namespace)).update(name, 'utf8').digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Deterministic UUID v5 used as Airwallex body request_id. */
export function airwallexRequestId(idempotencyKey: string): string {
  return uuidV5(idempotencyKey, AIRWALLEX_REQUEST_ID_NAMESPACE);
}

/** Distinct request_id so validate/quote never consumes the submit idempotency slot. */
export function airwallexQuoteRequestId(idempotencyKey: string): string {
  return uuidV5(`quote:${idempotencyKey}`, AIRWALLEX_REQUEST_ID_NAMESPACE);
}
