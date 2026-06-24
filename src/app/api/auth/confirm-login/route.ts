import { NextRequest } from 'next/server';
import { AuditEventType } from '@/lib/audit/audit-log';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { authJsonError, authSuccess } from '@/lib/auth/auth-api.shared';
import { clearSuspiciousLoginFlag } from '@/lib/auth/login-tracking.server';

/**
 * POST /api/auth/confirm-login — acknowledge suspicious login after re-authentication.
 */
export async function POST(request: NextRequest) {
  const auth = await getCurrentUserForApi(request, {
    allowUnverifiedEmail: true,
    allowSuspiciousLogin: true,
  });
  if (!auth.user) {
    return auth.response ?? authJsonError('Authentication required', 401);
  }

  await clearSuspiciousLoginFlag(auth.user.id);

  recordAuthAuditEvent({
    eventType: AuditEventType.AUTH_SUSPICIOUS_LOGIN,
    userId: auth.user.id,
    email: auth.user.email ?? undefined,
    request,
    metadata: { action: 'confirmed' },
  });

  return authSuccess();
}
