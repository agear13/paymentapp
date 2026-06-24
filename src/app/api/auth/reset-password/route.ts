import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AuditEventType } from '@/lib/audit/audit-log';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';
import { GENERIC_RESET_RESPONSE, GENERIC_RATE_LIMIT } from '@/lib/auth/auth-errors';
import {
  checkPasswordResetRateLimit,
  incrementAuthFailureCounter,
  rateLimit429Response,
} from '@/lib/auth/auth-rate-limit.server';
import { authEmailSchema, authJsonError, authSuccess, turnstileTokenSchema } from '@/lib/auth/auth-api.shared';
import { isTurnstileRequired, verifyTurnstileToken } from '@/lib/auth/turnstile.server';
import { getClientIdentifier } from '@/lib/rate-limit';
import {
  createRouteHandlerSupabaseClient,
  resolveAuthRedirectOrigin,
} from '@/lib/supabase/route-handler-client';

const bodySchema = z.object({
  email: authEmailSchema,
  turnstileToken: turnstileTokenSchema,
});

/**
 * POST /api/auth/reset-password — rate-limited password reset with generic response.
 */
export async function POST(request: NextRequest) {
  const resetLimit = await checkPasswordResetRateLimit(request);
  if (!resetLimit.allowed) {
    return rateLimit429Response(GENERIC_RATE_LIMIT, resetLimit.retryAfterSeconds);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return authJsonError('Invalid request body', 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return authJsonError('Invalid reset payload', 400);
  }

  const { email, turnstileToken } = parsed.data;
  const ip = getClientIdentifier(request);

  const turnstileRequired = await isTurnstileRequired('reset', ip);
  if (turnstileRequired) {
    const valid = await verifyTurnstileToken(turnstileToken, ip);
    if (!valid) {
      await incrementAuthFailureCounter('reset', ip);
      return authJsonError('Security verification failed. Please try again.', 400, {
        turnstileRequired: true,
      });
    }
  }

  const supabase = await createRouteHandlerSupabaseClient();
  const origin = resolveAuthRedirectOrigin(request);

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/reset-password`,
  });

  recordAuthAuditEvent({
    eventType: AuditEventType.AUTH_PASSWORD_RESET_REQUESTED,
    email,
    request,
    success: !error,
    reason: error?.message,
  });

  if (error) {
    await incrementAuthFailureCounter('reset', ip);
  }

  return authSuccess({ message: GENERIC_RESET_RESPONSE });
}
