import 'server-only';

import crypto from 'crypto';

const SIGNATURE_MAX_AGE_SECONDS = 5 * 60;

export function parseCalendlyWebhookSignatureHeader(
  header: string | null
): { timestamp: string | null; signature: string | null } {
  if (!header) {
    return { timestamp: null, signature: null };
  }

  let timestamp: string | null = null;
  let signature: string | null = null;

  for (const part of header.split(',')) {
    const [key, value] = part.split('=');
    if (key === 't') timestamp = value ?? null;
    if (key === 'v1') signature = value ?? null;
  }

  return { timestamp, signature };
}

export function verifyCalendlyWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  signingKey: string;
}): boolean {
  const { timestamp, signature } = parseCalendlyWebhookSignatureHeader(input.signatureHeader);

  if (!timestamp || !signature) {
    return false;
  }

  const timestampSeconds = Number.parseInt(timestamp, 10);
  if (Number.isNaN(timestampSeconds)) {
    return false;
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - timestampSeconds;
  if (ageSeconds < 0 || ageSeconds > SIGNATURE_MAX_AGE_SECONDS) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', input.signingKey)
    .update(`${timestamp}.${input.rawBody}`)
    .digest('hex');

  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(provided, expected);
}
