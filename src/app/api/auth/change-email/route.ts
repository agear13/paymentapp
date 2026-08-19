import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AuditEventType } from '@/lib/audit/audit-log';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { authEmailSchema, authJsonError, authSuccess } from '@/lib/auth/auth-api.shared';
import { DISPOSABLE_EMAIL_MESSAGE, isDisposableEmail } from '@/lib/auth/disposable-email';
import { isEmailVerified } from '@/lib/auth/email-verification';
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/route-handler-client';

const bodySchema = z.object({
  email: authEmailSchema,
});

const AUTH_LIFECYCLE_OPTIONS = {
  allowUnverifiedEmail: true,
  allowSuspiciousLogin: true,
  allowAal1: true,
} as const;

/**
 * POST /api/auth/change-email — unverified onboarding only.
 * Verified accounts must use /api/security/change-email with MFA/AAL2.
 */
export async function POST(request: NextRequest) {
  const auth = await getCurrentUserForApi(request, AUTH_LIFECYCLE_OPTIONS);
  if (!auth.user) {
    return auth.response ?? authJsonError('Authentication required', 401);
  }

  if (isEmailVerified(auth.user)) {
    return authJsonError(
      'Verified accounts must confirm an email change from Sign-in & Security with two-factor authentication.',
      403,
      { code: 'STEP_UP_REQUIRED' }
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
    return authJsonError('Invalid email address', 400);
  }

  const { email } = parsed.data;
  if (isDisposableEmail(email)) {
    return authJsonError(DISPOSABLE_EMAIL_MESSAGE, 400);
  }

  const supabase = await createRouteHandlerSupabaseClient();
  const { error } = await supabase.auth.updateUser({ email });

  if (error) {
    return authJsonError('Could not update email. It may already be in use.', 400);
  }

  recordAuthAuditEvent({
    eventType: AuditEventType.AUTH_EMAIL_CHANGED,
    userId: auth.user.id,
    email,
    request,
    metadata: { previousEmail: auth.user.email, unverifiedOnboarding: true },
  });

  recordAuthAuditEvent({
    eventType: AuditEventType.AUTH_VERIFICATION_EMAIL_SENT,
    userId: auth.user.id,
    email,
    request,
  });

  return authSuccess({
    message: 'Email updated. Please check your inbox to verify the new address.',
  });
}
