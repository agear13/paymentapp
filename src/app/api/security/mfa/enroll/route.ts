import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { authJsonError, authSuccess } from '@/lib/auth/auth-api.shared';
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/route-handler-client';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';
import { AuditEventType } from '@/lib/audit/audit-log';

const MFA_SESSION_OPTIONS = {
  allowAal1: true,
  allowSuspiciousLogin: true,
} as const;

const bodySchema = z.object({
  friendlyName: z.string().min(1).max(64).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await getCurrentUserForApi(request, MFA_SESSION_OPTIONS);
  if (!auth.user) {
    return auth.response ?? authJsonError('Authentication required', 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = bodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return authJsonError('Invalid enroll payload', 400);
  }

  const supabase = await createRouteHandlerSupabaseClient();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: parsed.data.friendlyName ?? 'Authenticator',
  });

  if (error || !data) {
    recordAuthAuditEvent({
      eventType: AuditEventType.AUTH_MFA_CHALLENGE_FAILED,
      userId: auth.user.id,
      email: auth.user.email ?? undefined,
      request,
      success: false,
      reason: error?.message ?? 'enroll_failed',
    });
    return authJsonError('Could not start authenticator enrollment.', 400);
  }

  return authSuccess({
    factorId: data.id,
    totp: {
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    },
  });
}
