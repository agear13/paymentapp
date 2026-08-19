import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AuditEventType } from '@/lib/audit/audit-log';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { authJsonError, authSuccess } from '@/lib/auth/auth-api.shared';
import { validatePassword } from '@/lib/auth/password-policy';
import { revokeUserSessions } from '@/lib/auth/session-revoke.server';
import { notifyAccountSecurityEvent } from '@/lib/auth/sensitive-action-notify.server';
import { getMfaAssuranceSnapshot } from '@/lib/auth/mfa.server';
import { hasRecoveryAmr } from '@/lib/auth/mfa-assurance';
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/route-handler-client';

const RECOVERY_OPTIONS = {
  allowAal1: true,
  allowUnverifiedEmail: true,
  allowSuspiciousLogin: true,
} as const;

const bodySchema = z.object({
  password: z.string().min(1).max(256),
});

/**
 * POST /api/security/complete-password-reset
 * Completes a recovery-session password update and revokes all sessions globally.
 */
export async function POST(request: NextRequest) {
  const auth = await getCurrentUserForApi(request, RECOVERY_OPTIONS);
  if (!auth.user) {
    return auth.response ?? authJsonError('Authentication required', 401);
  }

  const snapshot = await getMfaAssuranceSnapshot();
  if (!hasRecoveryAmr(snapshot.methods)) {
    return authJsonError(
      'Password reset requires a valid recovery link. Use Sign-in & Security to change your password.',
      403,
      { code: 'RECOVERY_SESSION_REQUIRED' }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return authJsonError('Invalid request body', 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return authJsonError('Invalid password payload', 400);
  }

  const passwordCheck = validatePassword(parsed.data.password, auth.user.email ?? undefined);
  if (!passwordCheck.valid) {
    return authJsonError(passwordCheck.message, 400);
  }

  const supabase = await createRouteHandlerSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return authJsonError('Could not update password.', 400);
  }

  await revokeUserSessions(auth.user.id, 'global');

  recordAuthAuditEvent({
    eventType: AuditEventType.AUTH_PASSWORD_RESET_COMPLETED,
    userId: auth.user.id,
    email: auth.user.email ?? undefined,
    request,
    metadata: { sessionsRevoked: 'global' },
  });

  await notifyAccountSecurityEvent({
    to: auth.user.email,
    subject: 'Your Provvypay password was reset',
    text: 'Your Provvypay password was reset and all sessions were signed out. If you did not do this, contact support immediately.',
  });

  return authSuccess({
    message: 'Password updated. Sign in again with your new password.',
    sessionsRevoked: 'global',
  });
}
