import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AuditEventType } from '@/lib/audit/audit-log';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { authEmailSchema, authJsonError, authSuccess } from '@/lib/auth/auth-api.shared';
import { DISPOSABLE_EMAIL_MESSAGE, isDisposableEmail } from '@/lib/auth/disposable-email';
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/route-handler-client';

const bodySchema = z.object({
  email: authEmailSchema,
});

const AUTH_LIFECYCLE_OPTIONS = {
  allowUnverifiedEmail: true,
  allowSuspiciousLogin: true,
} as const;

/**
 * POST /api/auth/change-email — update email for unverified accounts (re-sends verification).
 */
export async function POST(request: NextRequest) {
  const auth = await getCurrentUserForApi(request, AUTH_LIFECYCLE_OPTIONS);
  if (!auth.user) {
    return auth.response ?? authJsonError('Authentication required', 401);
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
    metadata: { previousEmail: auth.user.email },
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
