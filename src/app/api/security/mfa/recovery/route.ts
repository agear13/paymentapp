import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { authJsonError, authSuccess } from '@/lib/auth/auth-api.shared';
import {
  checkMfaVerifyRateLimit,
  rateLimit429Response,
} from '@/lib/auth/auth-rate-limit.server';
import { GENERIC_RATE_LIMIT } from '@/lib/auth/auth-errors';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';
import { AuditEventType } from '@/lib/audit/audit-log';
import {
  consumeRecoveryCode,
  deleteAllTotpFactorsForUser,
} from '@/lib/auth/mfa.server';
import { prisma } from '@/lib/server/prisma';
import { revokeUserSessions } from '@/lib/auth/session-revoke.server';
import { notifyAccountSecurityEvent } from '@/lib/auth/sensitive-action-notify.server';

const MFA_SESSION_OPTIONS = {
  allowAal1: true,
  allowSuspiciousLogin: true,
} as const;

const bodySchema = z.object({
  code: z.string().min(8).max(12),
});

export async function POST(request: NextRequest) {
  const auth = await getCurrentUserForApi(request, MFA_SESSION_OPTIONS);
  if (!auth.user) {
    return auth.response ?? authJsonError('Authentication required', 401);
  }

  const limit = await checkMfaVerifyRateLimit(`recovery:${auth.user.id}`);
  if (!limit.allowed) {
    return rateLimit429Response(GENERIC_RATE_LIMIT, limit.retryAfterSeconds);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return authJsonError('Invalid request body', 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return authJsonError('Invalid recovery code', 400);
  }

  const consumed = await consumeRecoveryCode(auth.user.id, parsed.data.code);
  if (!consumed) {
    recordAuthAuditEvent({
      eventType: AuditEventType.AUTH_MFA_RECOVERY_USED,
      userId: auth.user.id,
      email: auth.user.email ?? undefined,
      request,
      success: false,
      reason: 'invalid_or_used_code',
    });
    return authJsonError('Invalid or already used recovery code.', 401);
  }

  await deleteAllTotpFactorsForUser(auth.user.id);
  await prisma.user_mfa_recovery_codes.deleteMany({
    where: { user_id: auth.user.id },
  });

  recordAuthAuditEvent({
    eventType: AuditEventType.AUTH_MFA_RECOVERY_USED,
    userId: auth.user.id,
    email: auth.user.email ?? undefined,
    request,
  });
  recordAuthAuditEvent({
    eventType: AuditEventType.AUTH_MFA_DISABLED,
    userId: auth.user.id,
    email: auth.user.email ?? undefined,
    request,
    metadata: { via: 'recovery' },
  });

  await revokeUserSessions(auth.user.id, 'global');
  await notifyAccountSecurityEvent({
    to: auth.user.email,
    subject: 'A recovery code was used on your account',
    text: 'A two-factor recovery code was used to disable authenticator access on your Provvypay account. Sign in again and re-enable two-factor authentication. If this was not you, reset your password immediately.',
  });

  return authSuccess({
    enrolled: false,
    sessionsRevoked: true,
    message: 'Two-factor authentication was disabled. Please sign in again.',
  });
}
