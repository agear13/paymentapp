import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AuditEventType } from '@/lib/audit/audit-log';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';
import { GENERIC_AUTH_FAILURE, GENERIC_RATE_LIMIT } from '@/lib/auth/auth-errors';
import {
  checkRegistrationRateLimit,
  incrementAuthFailureCounter,
  rateLimit429Response,
} from '@/lib/auth/auth-rate-limit.server';
import { authEmailSchema, authJsonError, authSuccess, turnstileTokenSchema } from '@/lib/auth/auth-api.shared';
import { DISPOSABLE_EMAIL_MESSAGE, isDisposableEmail } from '@/lib/auth/disposable-email';
import { validatePassword } from '@/lib/auth/password-policy';
import { isTurnstileRequired, verifyTurnstileToken } from '@/lib/auth/turnstile.server';
import { getClientIdentifier } from '@/lib/rate-limit';
import {
  createRouteHandlerSupabaseClient,
  resolveAuthRedirectOrigin,
} from '@/lib/supabase/route-handler-client';

const bodySchema = z.object({
  email: authEmailSchema,
  password: z.string().min(1).max(256),
  turnstileToken: turnstileTokenSchema,
});

/**
 * POST /api/auth/signup — server-side registration with abuse controls.
 */
export async function POST(request: NextRequest) {
  const registrationLimit = await checkRegistrationRateLimit(request);
  if (!registrationLimit.allowed) {
    recordAuthAuditEvent({
      eventType: AuditEventType.SECURITY_RATE_LIMIT_EXCEEDED,
      request,
      metadata: { scope: 'signup' },
      success: false,
    });
    return rateLimit429Response(GENERIC_RATE_LIMIT, registrationLimit.retryAfterSeconds);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return authJsonError('Invalid request body', 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return authJsonError('Invalid signup payload', 400);
  }

  const { email, password, turnstileToken } = parsed.data;
  const ip = getClientIdentifier(request);

  if (isDisposableEmail(email)) {
    return authJsonError(DISPOSABLE_EMAIL_MESSAGE, 400);
  }

  const passwordCheck = validatePassword(password, email);
  if (!passwordCheck.valid) {
    return authJsonError(passwordCheck.message, 400);
  }

  const turnstileRequired = await isTurnstileRequired('signup', ip);
  if (turnstileRequired) {
    const valid = await verifyTurnstileToken(turnstileToken, ip);
    if (!valid) {
      await incrementAuthFailureCounter('signup', ip);
      return authJsonError('Security verification failed. Please try again.', 400, {
        turnstileRequired: true,
      });
    }
  }

  const supabase = await createRouteHandlerSupabaseClient();
  const origin = resolveAuthRedirectOrigin(request);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?type=signup`,
    },
  });

  if (error) {
    await incrementAuthFailureCounter('signup', ip);
    recordAuthAuditEvent({
      eventType: AuditEventType.AUTH_LOGIN_FAILED,
      email,
      request,
      success: false,
      reason: error.message,
      metadata: { scope: 'signup' },
    });
    return authJsonError(GENERIC_AUTH_FAILURE, 400);
  }

  if (data.user && !data.user.identities?.length) {
    return authJsonError(GENERIC_AUTH_FAILURE, 400);
  }

  recordAuthAuditEvent({
    eventType: AuditEventType.AUTH_ACCOUNT_CREATED,
    userId: data.user?.id,
    email,
    request,
  });

  recordAuthAuditEvent({
    eventType: AuditEventType.AUTH_VERIFICATION_EMAIL_SENT,
    userId: data.user?.id,
    email,
    request,
  });

  const requiresVerification = !data.session || !data.user?.email_confirmed_at;

  return authSuccess({
    requiresVerification,
    message: requiresVerification
      ? 'Check your email to verify your account before signing in.'
      : undefined,
  });
}
