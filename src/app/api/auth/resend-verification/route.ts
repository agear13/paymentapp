import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AuditEventType } from '@/lib/audit/audit-log';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';
import {
  GENERIC_RATE_LIMIT,
  GENERIC_VERIFICATION_RESEND_RESPONSE,
  isBenignVerificationResendError,
} from '@/lib/auth/auth-errors';
import {
  checkResendVerificationRateLimit,
  getVerificationResendCooldownRemaining,
  rateLimit429Response,
  RESEND_COOLDOWN_SECONDS,
  setVerificationResendCooldown,
  verificationResendIdentity,
} from '@/lib/auth/auth-rate-limit.server';
import { authEmailSchema, authJsonError, authSuccess } from '@/lib/auth/auth-api.shared';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { getCurrentUser } from '@/lib/auth/session';
import {
  createRouteHandlerSupabaseClient,
  resolveAuthRedirectOrigin,
} from '@/lib/supabase/route-handler-client';
import { journeySignupEmailRedirectTo } from '@/lib/journey/commercial-os-routes';

const bodySchema = z
  .object({
    email: authEmailSchema.optional(),
  })
  .optional();

const AUTH_LIFECYCLE_OPTIONS = {
  allowUnverifiedEmail: true,
  allowSuspiciousLogin: true,
  allowAal1: true,
} as const;

function cooldownResponse(retryAfterSeconds: number) {
  return authJsonError(
    `You can request another verification email in ${retryAfterSeconds} seconds.`,
    429,
    { retryAfterSeconds }
  );
}

/**
 * POST /api/auth/resend-verification — resend signup confirmation email (60s cooldown).
 * Works with or without a session so the post-signup "check your email" screen can resend.
 * Unauthenticated responses are generic so they do not reveal whether an address exists.
 */
export async function POST(request: NextRequest) {
  let body: z.infer<typeof bodySchema> = {};
  try {
    const raw = await request.text();
    if (raw) {
      body = bodySchema.parse(JSON.parse(raw));
    }
  } catch {
    return authJsonError('Invalid request body', 400);
  }

  const auth = await getCurrentUserForApi(request, AUTH_LIFECYCLE_OPTIONS);
  const user = auth.user;
  const sessionEmail = user?.email ?? null;
  const email = sessionEmail ?? body?.email ?? null;

  if (!email) {
    return authJsonError('Enter the email address to verify.', 400);
  }

  if (sessionEmail && body?.email && email.toLowerCase() !== body.email.toLowerCase()) {
    return authJsonError('Email does not match the signed-in account', 400);
  }

  const identity = verificationResendIdentity({ userId: user?.id, email });
  const cooldown = await getVerificationResendCooldownRemaining(identity);
  if (cooldown > 0) {
    return cooldownResponse(cooldown);
  }

  const hourlyLimit = await checkResendVerificationRateLimit(request, identity);
  if (!hourlyLimit.allowed) {
    return rateLimit429Response(GENERIC_RATE_LIMIT, hourlyLimit.retryAfterSeconds);
  }

  const supabase = await createRouteHandlerSupabaseClient();
  const origin = resolveAuthRedirectOrigin(request);

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: journeySignupEmailRedirectTo(origin),
    },
  });

  const authenticated = Boolean(user?.id);
  if (error && authenticated && !isBenignVerificationResendError(error)) {
    return authJsonError('Could not send verification email. Please try again later.', 500);
  }

  await setVerificationResendCooldown(identity);

  recordAuthAuditEvent({
    eventType: AuditEventType.AUTH_VERIFICATION_EMAIL_SENT,
    userId: user?.id,
    email,
    request,
    success: !error || isBenignVerificationResendError(error),
    reason: error?.message,
  });

  return authSuccess({
    retryAfterSeconds: RESEND_COOLDOWN_SECONDS,
    message: GENERIC_VERIFICATION_RESEND_RESPONSE,
  });
}

/**
 * GET /api/auth/resend-verification — remaining cooldown seconds for UI countdown.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return authSuccess({ cooldownRemaining: 0 });
  }

  const cooldown = await getVerificationResendCooldownRemaining(user.id);
  return authSuccess({ cooldownRemaining: cooldown });
}
