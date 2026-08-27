/**
 * Participant portal Test-as-participant context.
 * Server-issued, HMAC-signed, short-lived. Not Supabase impersonation.
 * Does not bind authenticated_user_id.
 */

import crypto from 'crypto';

export const PARTICIPANT_TEST_CONTEXT_COOKIE = 'provvy_participant_test_context';
export const PARTICIPANT_TEST_CONTEXT_MAX_AGE_SECONDS = 30 * 60;
export const PARTICIPANT_TEST_CONTEXT_DEVELOPER_PATH =
  '/dashboard/admin/developer/participant-portal';

export type ParticipantAccessGrant = 'genuine' | 'test_context' | 'operator_preview';

export type ParticipantTestContextPayload = {
  actorUserId: string;
  participantId: string;
  portalToken: string;
  exp: number;
  nonce: string;
};

export type VerifiedParticipantTestContext = ParticipantTestContextPayload;

export type ParticipantTestEligibilityInput = {
  actorUserId: string;
  dealOwnerUserId: string;
  authenticatedUserId?: string | null;
};

export type ParticipantTestEligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: 'not_deal_owner' | 'bound_to_other_user' | 'missing_actor' };

export function isParticipantTestContextEnabled(env?: {
  NODE_ENV?: string;
  ENABLE_PARTICIPANT_TEST_CONTEXT?: string;
  ALLOW_STRIPE_TEST_KEYS?: string;
}): boolean {
  const source = env ?? {
    NODE_ENV: process.env.NODE_ENV,
    ENABLE_PARTICIPANT_TEST_CONTEXT: process.env.ENABLE_PARTICIPANT_TEST_CONTEXT,
    ALLOW_STRIPE_TEST_KEYS: process.env.ALLOW_STRIPE_TEST_KEYS,
  };
  const optedIn = ['true', '1'].includes(
    (source.ENABLE_PARTICIPANT_TEST_CONTEXT ?? '').trim().toLowerCase()
  );
  if (!optedIn) return false;
  if (source.NODE_ENV === 'production') {
    // Existing B5 staging marker (production-env-guards C5). Live GA must not set this.
    return source.ALLOW_STRIPE_TEST_KEYS === 'true';
  }
  return true;
}

export function isEligibleParticipantTestSubject(
  input: ParticipantTestEligibilityInput
): ParticipantTestEligibilityResult {
  const actorUserId = input.actorUserId?.trim() ?? '';
  if (!actorUserId) return { eligible: false, reason: 'missing_actor' };
  if (input.dealOwnerUserId !== actorUserId) {
    return { eligible: false, reason: 'not_deal_owner' };
  }
  const boundId = input.authenticatedUserId?.trim() || null;
  if (boundId && boundId !== actorUserId) {
    return { eligible: false, reason: 'bound_to_other_user' };
  }
  return { eligible: true };
}

export function createParticipantTestContextPayload(input: {
  actorUserId: string;
  participantId: string;
  portalToken: string;
  ttlSeconds?: number;
  nowMs?: number;
}): ParticipantTestContextPayload {
  const nowMs = input.nowMs ?? Date.now();
  const ttl = input.ttlSeconds ?? PARTICIPANT_TEST_CONTEXT_MAX_AGE_SECONDS;
  return {
    actorUserId: input.actorUserId.trim(),
    participantId: input.participantId.trim(),
    portalToken: input.portalToken.trim(),
    exp: Math.floor(nowMs / 1000) + ttl,
    nonce: crypto.randomBytes(16).toString('hex'),
  };
}

export function signParticipantTestContext(
  payload: ParticipantTestContextPayload,
  secret: string
): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyParticipantTestContext(
  cookieValue: string | null | undefined,
  secret: string,
  nowMs: number = Date.now()
): ParticipantTestContextPayload | null {
  if (!cookieValue?.trim() || !secret) return null;
  const parts = cookieValue.trim().split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;

  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length) return null;
  if (!crypto.timingSafeEqual(expectedBuf, signatureBuf)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!isParticipantTestContextPayload(parsed)) return null;
  if (parsed.exp * 1000 <= nowMs) return null;
  return parsed;
}

export function isUsableParticipantTestContext(input: {
  user: { id: string } | null;
  participantId?: string | null;
  portalToken?: string | null;
  testContext?: VerifiedParticipantTestContext | null;
}): boolean {
  const userId = input.user?.id?.trim();
  const participantId = input.participantId?.trim();
  const ctx = input.testContext;
  if (!userId || !participantId || !ctx) return false;
  if (ctx.actorUserId !== userId) return false;
  if (ctx.participantId !== participantId) return false;
  const expectedToken = input.portalToken?.trim();
  if (expectedToken && ctx.portalToken !== expectedToken) return false;
  return true;
}

export function resolveVerifiedParticipantTestContext(input: {
  enabled: boolean;
  cookieValue?: string | null;
  secret: string;
  actorUserId: string;
  participantId: string;
  portalToken?: string | null;
  dealOwnerUserId: string;
  authenticatedUserId?: string | null;
  nowMs?: number;
}): VerifiedParticipantTestContext | null {
  if (!input.enabled) return null;
  const payload = verifyParticipantTestContext(
    input.cookieValue,
    input.secret,
    input.nowMs ?? Date.now()
  );
  if (!payload) return null;
  if (payload.actorUserId !== input.actorUserId.trim()) return null;
  if (payload.participantId !== input.participantId.trim()) return null;
  const expectedToken = input.portalToken?.trim();
  if (expectedToken && payload.portalToken !== expectedToken) return null;
  const eligibility = isEligibleParticipantTestSubject({
    actorUserId: input.actorUserId,
    dealOwnerUserId: input.dealOwnerUserId,
    authenticatedUserId: input.authenticatedUserId,
  });
  if (!eligibility.eligible) return null;
  return payload;
}

function isParticipantTestContextPayload(value: unknown): value is ParticipantTestContextPayload {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.actorUserId === 'string' &&
    row.actorUserId.trim().length > 0 &&
    typeof row.participantId === 'string' &&
    row.participantId.trim().length > 0 &&
    typeof row.portalToken === 'string' &&
    row.portalToken.trim().length > 0 &&
    typeof row.exp === 'number' &&
    Number.isFinite(row.exp) &&
    typeof row.nonce === 'string' &&
    row.nonce.trim().length > 0
  );
}

export function participantTestContextCookieOptions(clear?: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: clear ? 0 : PARTICIPANT_TEST_CONTEXT_MAX_AGE_SECONDS,
  };
}
