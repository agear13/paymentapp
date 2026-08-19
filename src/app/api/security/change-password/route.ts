import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AuditEventType } from '@/lib/audit/audit-log';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { authJsonError, authSuccess } from '@/lib/auth/auth-api.shared';
import { validatePassword } from '@/lib/auth/password-policy';
import { assertRecentStepUp } from '@/lib/auth/step-up.server';
import { revokeUserSessions } from '@/lib/auth/session-revoke.server';
import { notifyAccountSecurityEvent } from '@/lib/auth/sensitive-action-notify.server';
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/route-handler-client';

const bodySchema = z.object({
  password: z.string().min(1).max(256),
});

/**
 * POST /api/security/change-password — authenticated password change with MFA/AAL2.
 */
export async function POST(request: NextRequest) {
  const auth = await getCurrentUserForApi(request);
  if (!auth.user) {
    return auth.response ?? authJsonError('Authentication required', 401);
  }

  const stepUp = await assertRecentStepUp({
    request,
    userId: auth.user.id,
    email: auth.user.email,
  });
  if (!stepUp.ok) return stepUp.response;

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

  await revokeUserSessions(auth.user.id, 'others');

  recordAuthAuditEvent({
    eventType: AuditEventType.AUTH_PASSWORD_CHANGE,
    userId: auth.user.id,
    email: auth.user.email ?? undefined,
    request,
    metadata: { sessionsRevoked: 'others' },
  });

  await notifyAccountSecurityEvent({
    to: auth.user.email,
    subject: 'Your Provvypay password was changed',
    text: 'The password on your Provvypay account was changed. Other sessions were signed out. If you did not do this, reset your password immediately and contact support.',
  });

  return authSuccess({
    message: 'Password updated. Other sessions have been signed out.',
    sessionsRevoked: 'others',
  });
}
