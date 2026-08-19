import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { authJsonError, authSuccess } from '@/lib/auth/auth-api.shared';
import {
  checkMfaVerifyRateLimit,
  rateLimit429Response,
} from '@/lib/auth/auth-rate-limit.server';
import { GENERIC_RATE_LIMIT } from '@/lib/auth/auth-errors';
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/route-handler-client';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';
import { AuditEventType } from '@/lib/audit/audit-log';
import { replaceRecoveryCodes } from '@/lib/auth/mfa.server';

const MFA_SESSION_OPTIONS = {
  allowAal1: true,
  allowSuspiciousLogin: true,
} as const;

const bodySchema = z.object({
  factorId: z.string().min(1),
  challengeId: z.string().min(1),
  code: z.string().min(6).max(12),
  purpose: z.enum(['enrollment', 'challenge', 'step-up']).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await getCurrentUserForApi(request, MFA_SESSION_OPTIONS);
  if (!auth.user) {
    return auth.response ?? authJsonError('Authentication required', 401);
  }

  const limit = await checkMfaVerifyRateLimit(auth.user.id);
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
    return authJsonError('Invalid authenticator payload', 400);
  }

  const supabase = await createRouteHandlerSupabaseClient();
  const { error } = await supabase.auth.mfa.verify({
    factorId: parsed.data.factorId,
    challengeId: parsed.data.challengeId,
    code: parsed.data.code.replace(/\s/g, ''),
  });

  if (error) {
    recordAuthAuditEvent({
      eventType: AuditEventType.AUTH_MFA_CHALLENGE_FAILED,
      userId: auth.user.id,
      email: auth.user.email ?? undefined,
      request,
      success: false,
      reason: error.message,
      metadata: { purpose: parsed.data.purpose ?? 'challenge' },
    });
    return authJsonError('Invalid authenticator code.', 401);
  }

  const purpose = parsed.data.purpose ?? 'challenge';
  let recoveryCodes: string[] | undefined;
  if (purpose === 'enrollment') {
    recoveryCodes = await replaceRecoveryCodes(auth.user.id);
    recordAuthAuditEvent({
      eventType: AuditEventType.AUTH_MFA_ENABLED,
      userId: auth.user.id,
      email: auth.user.email ?? undefined,
      request,
    });
  } else {
    recordAuthAuditEvent({
      eventType: AuditEventType.AUTH_MFA_CHALLENGE_SUCCESS,
      userId: auth.user.id,
      email: auth.user.email ?? undefined,
      request,
      metadata: { purpose },
    });
  }

  return authSuccess({
    currentLevel: 'aal2',
    recoveryCodes,
  });
}
