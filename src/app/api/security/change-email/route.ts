import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AuditEventType } from '@/lib/audit/audit-log';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { authEmailSchema, authJsonError, authSuccess } from '@/lib/auth/auth-api.shared';
import { DISPOSABLE_EMAIL_MESSAGE, isDisposableEmail } from '@/lib/auth/disposable-email';
import { isEmailVerified } from '@/lib/auth/email-verification';
import { assertRecentStepUp } from '@/lib/auth/step-up.server';
import { revokeUserSessions } from '@/lib/auth/session-revoke.server';
import { notifyAccountSecurityEvent } from '@/lib/auth/sensitive-action-notify.server';
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/route-handler-client';

const bodySchema = z.object({
  email: authEmailSchema,
});

/**
 * POST /api/security/change-email — verified accounts only. Requires recent MFA/AAL2.
 */
export async function POST(request: NextRequest) {
  const auth = await getCurrentUserForApi(request);
  if (!auth.user) {
    return auth.response ?? authJsonError('Authentication required', 401);
  }

  if (!isEmailVerified(auth.user)) {
    return authJsonError('Use the verification page to change an unverified email address.', 400);
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
    return authJsonError('Invalid email address', 400);
  }

  const { email } = parsed.data;
  if (isDisposableEmail(email)) {
    return authJsonError(DISPOSABLE_EMAIL_MESSAGE, 400);
  }

  const previousEmail = auth.user.email;
  if (previousEmail && previousEmail.toLowerCase() === email.toLowerCase()) {
    return authJsonError('That is already your email address.', 400);
  }

  const supabase = await createRouteHandlerSupabaseClient();
  const { error } = await supabase.auth.updateUser({ email });

  if (error) {
    return authJsonError('Could not update email. It may already be in use.', 400);
  }

  await revokeUserSessions(auth.user.id, 'others');

  recordAuthAuditEvent({
    eventType: AuditEventType.AUTH_EMAIL_CHANGED,
    userId: auth.user.id,
    email,
    request,
    metadata: { previousEmail, sessionsRevoked: 'others' },
  });

  recordAuthAuditEvent({
    eventType: AuditEventType.AUTH_VERIFICATION_EMAIL_SENT,
    userId: auth.user.id,
    email,
    request,
  });

  await notifyAccountSecurityEvent({
    to: previousEmail,
    subject: 'Your Provvypay email address was changed',
    text: `A request was made to change the email on your Provvypay account to ${email}. Confirm the new address from the inbox we sent to it. If you did not request this, reset your password immediately.`,
  });

  return authSuccess({
    message: 'Check the new inbox to confirm this email change. Other sessions have been signed out.',
    sessionsRevoked: 'others',
  });
}
