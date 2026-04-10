import crypto from 'crypto';

const OAUTH_STATE_TTL_SECONDS = 10 * 60;

type StatePayload = Record<string, unknown>;

function getOAuthStateSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('OAuth state secret is not configured');
  }
  return secret;
}

export function signOAuthState(payload: StatePayload): string {
  const now = Math.floor(Date.now() / 1000);
  const message = JSON.stringify({ ...payload, iat: now });
  const encodedMessage = Buffer.from(message, 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', getOAuthStateSecret())
    .update(encodedMessage)
    .digest('base64url');

  return `${encodedMessage}.${signature}`;
}

export function verifyOAuthState<T extends StatePayload>(state: string): T | null {
  const [encodedMessage, signature] = state.split('.');
  if (!encodedMessage || !signature) return null;

  const expectedSignature = crypto
    .createHmac('sha256', getOAuthStateSecret())
    .update(encodedMessage)
    .digest('base64url');

  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encodedMessage, 'base64url').toString('utf8')) as T & { iat?: number };
    if (!parsed?.iat || typeof parsed.iat !== 'number') return null;

    const ageSeconds = Math.floor(Date.now() / 1000) - parsed.iat;
    if (ageSeconds < 0 || ageSeconds > OAUTH_STATE_TTL_SECONDS) return null;

    return parsed;
  } catch {
    return null;
  }
}
