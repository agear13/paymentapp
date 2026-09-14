import 'server-only';

import crypto from 'node:crypto';
import { resolveMarketingUnsubscribeSecret } from '@/lib/marketing/marketing-unsubscribe-secret.server';

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 365;

type TokenPayload = {
  sid: string;
  exp: number;
};

function signPayload(encodedPayload: string): string {
  return crypto
    .createHmac('sha256', resolveMarketingUnsubscribeSecret())
    .update(encodedPayload)
    .digest('base64url');
}

export function createMarketingUnsubscribeToken(signupId: string, nowMs = Date.now()): string {
  const payload: TokenPayload = {
    sid: signupId,
    exp: nowMs + TOKEN_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function verifyMarketingUnsubscribeToken(
  token: string,
  nowMs = Date.now()
): { signupId: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) return null;

  const expected = signPayload(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as TokenPayload;
    if (!payload.sid || typeof payload.exp !== 'number') return null;
    if (payload.exp < nowMs) return null;
    return { signupId: payload.sid };
  } catch {
    return null;
  }
}

export function buildMarketingUnsubscribeUrl(signupId: string, appUrl: string): string {
  const base = appUrl.replace(/\/$/, '');
  const token = createMarketingUnsubscribeToken(signupId);
  return `${base}/api/marketing/unsubscribe?token=${encodeURIComponent(token)}`;
}
