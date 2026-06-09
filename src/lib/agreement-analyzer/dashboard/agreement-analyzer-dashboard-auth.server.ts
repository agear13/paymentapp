import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import { checkAdminAuth, checkBetaAdminAuth } from '@/lib/auth/admin.server';
import { enforceCsrfForRequest } from '@/lib/security/csrf';

export async function checkAgreementAnalyzerDashboardAuth(): Promise<{
  isAuthorized: boolean;
  userEmail: string | null;
  user: { id: string; email?: string | null } | null;
  error: string | null;
}> {
  const [adminAuth, betaAdminAuth] = await Promise.all([checkAdminAuth(), checkBetaAdminAuth()]);

  if (adminAuth.isAdmin && adminAuth.user) {
    return {
      isAuthorized: true,
      userEmail: adminAuth.userEmail,
      user: adminAuth.user,
      error: null,
    };
  }

  if (betaAdminAuth.isAdmin && betaAdminAuth.user) {
    return {
      isAuthorized: true,
      userEmail: betaAdminAuth.userEmail,
      user: betaAdminAuth.user,
      error: null,
    };
  }

  return {
    isAuthorized: false,
    userEmail: adminAuth.userEmail ?? betaAdminAuth.userEmail,
    user: adminAuth.user ?? betaAdminAuth.user,
    error: adminAuth.error === 'Authentication required'
      ? adminAuth.error
      : 'Forbidden: Admin or internal team access required',
  };
}

export async function requireAgreementAnalyzerDashboardForApi(request: NextRequest) {
  const csrfBlock = enforceCsrfForRequest(request);
  if (csrfBlock) {
    return { user: null, response: csrfBlock };
  }

  const auth = await checkAgreementAnalyzerDashboardAuth();
  if (!auth.isAuthorized || !auth.user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: auth.error || 'Forbidden' },
        { status: auth.error === 'Authentication required' ? 401 : 403 }
      ),
    };
  }

  return { user: auth.user, response: null };
}
