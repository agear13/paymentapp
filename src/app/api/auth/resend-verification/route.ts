import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AuditEventType } from '@/lib/audit/audit-log';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { GENERIC_RATE_LIMIT } from '@/lib/auth/auth-errors';
import {
  checkResendVerificationRateLimit,
  getVerificationResendCooldownRemaining,
  rateLimit429Response,
  setVerificationResendCooldown,
} from '@/lib/auth/auth-rate-limit.server';
import { authJsonError, authSuccess } from '@/lib/auth/auth-api.shared';
import { getCurrentUser } from '@/lib/auth/session';
import {
  createRouteHandlerSupabaseClient,
  resolveAuthRedirectOrigin,
} from '@/lib/supabase/route-handler-client';

const bodySchema = z
  .object({
    email: z.string().email().optional(),
  })
  .optional();

const AUTH_LIFECYCLE_OPTIONS = {
  allowUnverifiedEmail: true,
  allowSuspiciousLogin: true,
} as const;

/**
 * POST /api/auth/resend-verification — resend signup confirmation email (60s cooldown).
 */
export async function POST(request: NextRequest) {
  const auth = await getCurrentUserForApi(request, AUTH_LIFECYCLE_OPTIONS);
  if (!auth.user?.email) {
    return auth.response ?? authJsonError('Authentication required', 401);
  }

  let body: z.infer<typeof bodySchema> = {};
  try {
    const raw = await request.text();
    if (raw) {
      body = bodySchema.parse(JSON.parse(raw));
    }
  } catch {
    return authJsonError('Invalid request body', 400);
  }

  const email = body?.email ?? auth.user.email;
  if (email.toLowerCase() !== auth.user.email.toLowerCase()) {
    return authJsonError('Email does not match the signed-in account', 400);
  }

  const cooldown = await getVerificationResendCooldownRemaining(auth.user.id);
  if (cooldown > 0) {
    return authJsonError(
      `You can request another verification email in ${cooldown} seconds.`,
      429,
      { retryAfterSeconds: cooldown }
    );
  }

  const hourlyLimit = await checkResendVerificationRateLimit(request, auth.user.id);
  if (!hourlyLimit.allowed) {
    return rateLimit429Response(GENERIC_RATE_LIMIT, hourlyLimit.retryAfterSeconds);
  }

  const supabase = await createRouteHandlerSupabaseClient();
  const origin = resolveAuthRedirectOrigin(request);

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?type=signup`,
    },
  });

  if (error) {
    return authJsonError('Could not send verification email. Please try again later.', 500);
  }

  await setVerificationResendCooldown(auth.user.id);

  recordAuthAuditEvent({
    eventType: AuditEventType.AUTH_VERIFICATION_EMAIL_SENT,
    userId: auth.user.id,
    email,
    request,
  });

  return authSuccess({
    retryAfterSeconds: Number.parseInt(
      process.env.AUTH_VERIFICATION_RESEND_COOLDOWN_SECONDS || '60',
      10
    ),
  });
}

/**
 * GET /api/auth/resend-verification — remaining cooldown seconds for UI countdown.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return authJsonError('Authentication required', 401);
  }

  const cooldown = await getVerificationResendCooldownRemaining(user.id);
  return authSuccess({ cooldownRemaining: cooldown });
}
