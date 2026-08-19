import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/api-session.server', () => ({
  getCurrentUserForApi: jest.fn(),
}));

jest.mock('@/lib/auth/step-up.server', () => ({
  assertRecentStepUp: jest.fn(),
}));

jest.mock('@/lib/auth/session-revoke.server', () => ({
  revokeUserSessions: jest.fn(),
}));

jest.mock('@/lib/auth/sensitive-action-notify.server', () => ({
  notifyAccountSecurityEvent: jest.fn(),
}));

jest.mock('@/lib/audit/auth-audit.server', () => ({
  recordAuthAuditEvent: jest.fn(),
}));

jest.mock('@/lib/supabase/route-handler-client', () => ({
  createRouteHandlerSupabaseClient: jest.fn(),
}));

jest.mock('@/lib/auth/mfa.server', () => ({
  getMfaAssuranceSnapshot: jest.fn(),
}));

import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { assertRecentStepUp } from '@/lib/auth/step-up.server';
import { revokeUserSessions } from '@/lib/auth/session-revoke.server';
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/route-handler-client';
import { getMfaAssuranceSnapshot } from '@/lib/auth/mfa.server';
import { POST as changeEmailLegacy } from '@/app/api/auth/change-email/route';
import { POST as changeEmailSecure } from '@/app/api/security/change-email/route';
import { POST as completePasswordReset } from '@/app/api/security/complete-password-reset/route';
import { POST as changePassword } from '@/app/api/security/change-password/route';

const mockGetCurrentUserForApi = getCurrentUserForApi as jest.Mock;
const mockAssertRecentStepUp = assertRecentStepUp as jest.Mock;
const mockRevokeUserSessions = revokeUserSessions as jest.Mock;
const mockCreateRouteHandlerSupabaseClient = createRouteHandlerSupabaseClient as jest.Mock;
const mockGetMfaAssuranceSnapshot = getMfaAssuranceSnapshot as jest.Mock;

const verifiedUser = {
  id: 'user-1',
  email: 'old@example.com',
  email_confirmed_at: '2026-01-01T00:00:00Z',
  app_metadata: { provider: 'email' },
};

const unverifiedUser = {
  id: 'user-2',
  email: 'new@example.com',
  email_confirmed_at: null,
  app_metadata: { provider: 'email' },
};

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('email and password session hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRevokeUserSessions.mockResolvedValue({ ok: true });
    mockCreateRouteHandlerSupabaseClient.mockResolvedValue({
      auth: {
        updateUser: jest.fn().mockResolvedValue({ error: null }),
      },
    });
  });

  it('rejects a verified account changing email through the onboarding endpoint', async () => {
    mockGetCurrentUserForApi.mockResolvedValue({ user: verifiedUser, response: null });

    const response = await changeEmailLegacy(
      jsonRequest('http://localhost/api/auth/change-email', { email: 'attacker@example.com' })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('STEP_UP_REQUIRED');
  });

  it('still allows unverified onboarding email changes', async () => {
    mockGetCurrentUserForApi.mockResolvedValue({ user: unverifiedUser, response: null });

    const response = await changeEmailLegacy(
      jsonRequest('http://localhost/api/auth/change-email', { email: 'fresh@company.com' })
    );

    expect(response.status).toBe(200);
  });

  it('requires recent MFA/AAL2 before a verified email change', async () => {
    mockGetCurrentUserForApi.mockResolvedValue({ user: verifiedUser, response: null });
    mockAssertRecentStepUp.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ code: 'STEP_UP_REQUIRED' }), { status: 403 }),
      code: 'STEP_UP_REQUIRED',
    });

    const response = await changeEmailSecure(
      jsonRequest('http://localhost/api/security/change-email', { email: 'new@company.com' })
    );

    expect(response.status).toBe(403);
    expect(mockRevokeUserSessions).not.toHaveBeenCalled();
  });

  it('revokes other sessions after a verified email change', async () => {
    mockGetCurrentUserForApi.mockResolvedValue({ user: verifiedUser, response: null });
    mockAssertRecentStepUp.mockResolvedValue({ ok: true });

    const response = await changeEmailSecure(
      jsonRequest('http://localhost/api/security/change-email', { email: 'new@company.com' })
    );

    expect(response.status).toBe(200);
    expect(mockRevokeUserSessions).toHaveBeenCalledWith('user-1', 'others');
  });

  it('revokes other sessions after an authenticated password change', async () => {
    mockGetCurrentUserForApi.mockResolvedValue({ user: verifiedUser, response: null });
    mockAssertRecentStepUp.mockResolvedValue({ ok: true });

    const response = await changePassword(
      jsonRequest('http://localhost/api/security/change-password', {
        password: 'correct-horse-battery-staple',
      })
    );

    expect(response.status).toBe(200);
    expect(mockRevokeUserSessions).toHaveBeenCalledWith('user-1', 'others');
  });

  it('revokes all sessions after a recovery-link password reset', async () => {
    mockGetCurrentUserForApi.mockResolvedValue({ user: verifiedUser, response: null });
    mockGetMfaAssuranceSnapshot.mockResolvedValue({
      methods: [{ method: 'recovery', timestamp: Math.floor(Date.now() / 1000) }],
    });

    const response = await completePasswordReset(
      jsonRequest('http://localhost/api/security/complete-password-reset', {
        password: 'correct-horse-battery-staple',
      })
    );

    expect(response.status).toBe(200);
    expect(mockRevokeUserSessions).toHaveBeenCalledWith('user-1', 'global');
  });

  it('does not allow a stolen authenticated session to complete password reset without recovery AMR', async () => {
    mockGetCurrentUserForApi.mockResolvedValue({ user: verifiedUser, response: null });
    mockGetMfaAssuranceSnapshot.mockResolvedValue({
      methods: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
    });

    const response = await completePasswordReset(
      jsonRequest('http://localhost/api/security/complete-password-reset', {
        password: 'correct-horse-battery-staple',
      })
    );

    expect(response.status).toBe(403);
    expect(mockRevokeUserSessions).not.toHaveBeenCalled();
  });
});
