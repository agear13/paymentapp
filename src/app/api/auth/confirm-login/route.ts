import { NextRequest } from 'next/server';
import { AuditEventType } from '@/lib/audit/audit-log';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';
import { authJsonError, authSuccess } from '@/lib/auth/auth-api.shared';
import { clearSuspiciousLoginFlag } from '@/lib/auth/login-tracking.server';
import { getCurrentUser } from '@/lib/auth/session';

/**
 * POST /api/auth/confirm-login — acknowledge suspicious login after re-authentication.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return authJsonError('Authentication required', 401);
  }

  await clearSuspiciousLoginFlag(user.id);

  recordAuthAuditEvent({
    eventType: AuditEventType.AUTH_SUSPICIOUS_LOGIN,
    userId: user.id,
    email: user.email ?? undefined,
    request,
    metadata: { action: 'confirmed' },
  });

  return authSuccess();
}
