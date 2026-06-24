import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AuditEventType } from '@/lib/audit/audit-log';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';
import {
  AUTH_LOCKED_MESSAGE,
  GENERIC_AUTH_FAILURE,
  GENERIC_RATE_LIMIT,
} from '@/lib/auth/auth-errors';
import {
  clearLoginFailures,
  getLoginLockoutRemaining,
  incrementAuthFailureCounter,
  rateLimit429Response,
  recordLoginFailure,
} from '@/lib/auth/auth-rate-limit.server';
import { authEmailSchema, authJsonError, authSuccess, turnstileTokenSchema } from '@/lib/auth/auth-api.shared';
import { isEmailVerified } from '@/lib/auth/email-verification';
import { recordSuccessfulLogin } from '@/lib/auth/login-tracking.server';
import { isTurnstileRequired, verifyTurnstileToken } from '@/lib/auth/turnstile.server';
import { getClientIdentifier } from '@/lib/rate-limit';
import {
  createRouteHandlerSupabaseClient,
} from '@/lib/supabase/route-handler-client';

const bodySchema = z.object({
  email: authEmailSchema,
  password: z.string().min(1).max(256),
  turnstileToken: turnstileTokenSchema,
});

/**
 * POST /api/auth/login — server-side sign-in with brute-force protection.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return authJsonError('Invalid request body', 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return authJsonError('Invalid login payload', 400);
  }

  const { email, password, turnstileToken } = parsed.data;
  const ip = getClientIdentifier(request);

  const lockout = await getLoginLockoutRemaining(email, ip);
  if (lockout.locked) {
    return rateLimit429Response(AUTH_LOCKED_MESSAGE, lockout.retryAfterSeconds);
  }

  const turnstileRequired = await isTurnstileRequired('login', ip);
  if (turnstileRequired) {
    const valid = await verifyTurnstileToken(turnstileToken, ip);
    if (!valid) {
      await incrementAuthFailureCounter('login', ip);
      return authJsonError('Security verification failed. Please try again.', 400, {
        turnstileRequired: true,
      });
    }
  }

  const supabase = await createRouteHandlerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    const failure = await recordLoginFailure(email, ip);
    await incrementAuthFailureCounter('login', ip);

    recordAuthAuditEvent({
      eventType: AuditEventType.AUTH_LOGIN_FAILED,
      email,
      request,
      success: false,
      reason: error?.message ?? 'unknown',
    });

    if (failure.locked) {
      return rateLimit429Response(AUTH_LOCKED_MESSAGE, failure.retryAfterSeconds);
    }

    return authJsonError(GENERIC_AUTH_FAILURE, 401, {
      turnstileRequired: failure.failureCount >= 3,
    });
  }

  await clearLoginFailures(email, ip);

  if (!isEmailVerified(data.user)) {
    await supabase.auth.signOut();
    return authJsonError(
      'Please verify your email address before signing in.',
      403,
      { code: 'EMAIL_NOT_VERIFIED', requiresVerification: true }
    );
  }

  const loginTracking = await recordSuccessfulLogin({
    userId: data.user.id,
    email: data.user.email ?? email,
    request,
  });

  recordAuthAuditEvent({
    eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
    userId: data.user.id,
    email: data.user.email ?? email,
    request,
    metadata: { suspicious: loginTracking.suspicious },
  });

  if (loginTracking.suspicious) {
    return authSuccess({
      suspiciousLogin: true,
      message: loginTracking.reason,
    });
  }

  return authSuccess({ userId: data.user.id });
}
