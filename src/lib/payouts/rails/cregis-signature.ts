import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Cregis request/callback signature.
 * Documented at https://developer.cregis.com/api-reference/signature
 *
 * 1. Drop `sign` and empty/null values
 * 2. Sort remaining keys lexicographically
 * 3. Concatenate key1value1key2value2...
 * 4. Prepend API Key
 * 5. MD5 hex lowercase
 *
 * The docs page shows two different example hashes for the same payload.
 * This implementation follows the algorithm and matches the final request
 * example (`d6eef2de79e39f434a38efb910213ba6`), not the intermediate step-4 value.
 */
export function signCregisPayload(
  params: Record<string, unknown>,
  apiKey: string
): string {
  const pieces: string[] = [];
  const keys = Object.keys(params)
    .filter((key) => {
      if (key === 'sign') return false;
      const value = params[key];
      return value !== null && value !== undefined && value !== '';
    })
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  for (const key of keys) {
    pieces.push(`${key}${stringifyCregisSignValue(params[key])}`);
  }

  return createHash('md5').update(`${apiKey}${pieces.join('')}`, 'utf8').digest('hex');
}

export function verifyCregisSignature(
  params: Record<string, unknown>,
  apiKey: string
): boolean {
  const provided = params.sign;
  if (typeof provided !== 'string' || !provided) return false;
  const expected = signCregisPayload(params, apiKey);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function cregisNonce(): string {
  return randomBytes(4).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).padEnd(6, 'x');
}

export function stringifyCregisSignValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value == null) return '';
  return String(value);
}
