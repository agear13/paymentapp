import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { enforceCsrfForRequest } from '@/lib/security/csrf';
import { isEmailVerified } from '@/lib/auth/email-verification';
import {
  assertNoPendingSuspiciousLogin,
  emailNotVerifiedResponse,
  suspiciousLoginResponse,
} from '@/lib/auth/verified-session.server';

export type ApiSessionOptions = {
  /** Auth lifecycle routes (verify email, change email) may run before confirmation. */
  allowUnverifiedEmail?: boolean;
  /** confirm-login must run while suspicious-login flag is set. */
  allowSuspiciousLogin?: boolean;
};

/**
 * Authenticated dashboard API access with CSRF enforcement for mutating requests.
 */
export async function getCurrentUserForApi(
  request: NextRequest,
  options?: ApiSessionOptions
): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>; response: null }
  | { user: null; response: NextResponse }
> {
  const csrfBlock = enforceCsrfForRequest(request);
  if (csrfBlock) return { user: null, response: csrfBlock };

  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  if (!options?.allowUnverifiedEmail && !isEmailVerified(user)) {
    return { user: null, response: emailNotVerifiedResponse() };
  }

  if (!options?.allowSuspiciousLogin) {
    try {
      await assertNoPendingSuspiciousLogin(user.id);
    } catch {
      return { user: null, response: suspiciousLoginResponse() };
    }
  }

  return { user, response: null };
}

/**
 * Admin session auth with CSRF enforcement for mutating dashboard requests.
 */
export async function requireAdminForApi(request: NextRequest) {
  const csrfBlock = enforceCsrfForRequest(request);
  if (csrfBlock) return { user: null, isAdmin: false, response: csrfBlock };

  const { checkAdminAuth } = await import('@/lib/auth/admin.server');
  const adminAuth = await checkAdminAuth();
  if (!adminAuth.isAdmin || !adminAuth.user) {
    return {
      user: null,
      isAdmin: false,
      response: NextResponse.json(
        { error: adminAuth.error || 'Forbidden' },
        { status: adminAuth.error === 'Authentication required' ? 401 : 403 }
      ),
    };
  }

  return { user: adminAuth.user, isAdmin: true, response: null };
}
