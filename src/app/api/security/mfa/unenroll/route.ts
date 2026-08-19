import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { authJsonError, authSuccess } from '@/lib/auth/auth-api.shared';
import { assertRecentStepUp } from '@/lib/auth/step-up.server';
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/route-handler-client';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';
import { AuditEventType } from '@/lib/audit/audit-log';
import { prisma } from '@/lib/server/prisma';
import { revokeUserSessions } from '@/lib/auth/session-revoke.server';
import { notifyAccountSecurityEvent } from '@/lib/auth/sensitive-action-notify.server';

const bodySchema = z.object({
  factorId: z.string().min(1),
});

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
    return authJsonError('factorId is required', 400);
  }

  const supabase = await createRouteHandlerSupabaseClient();
  const { error } = await supabase.auth.mfa.unenroll({
    factorId: parsed.data.factorId,
  });

  if (error) {
    recordAuthAuditEvent({
      eventType: AuditEventType.AUTH_MFA_DISABLED,
      userId: auth.user.id,
      email: auth.user.email ?? undefined,
      request,
      success: false,
      reason: error.message,
    });
    return authJsonError('Could not disable two-factor authentication.', 400);
  }

  await prisma.user_mfa_recovery_codes.deleteMany({
    where: { user_id: auth.user.id },
  });

  recordAuthAuditEvent({
    eventType: AuditEventType.AUTH_MFA_DISABLED,
    userId: auth.user.id,
    email: auth.user.email ?? undefined,
    request,
  });

  await revokeUserSessions(auth.user.id, 'others');
  await notifyAccountSecurityEvent({
    to: auth.user.email,
    subject: 'Two-factor authentication was turned off',
    text: 'Two-factor authentication was disabled on your Provvypay account. If you did not do this, reset your password and contact support immediately.',
  });

  return authSuccess({ enrolled: false });
}
