import { NextRequest, NextResponse } from 'next/server';

jest.mock('@/lib/auth/api-session.server', () => ({
  getCurrentUserForApi: jest.fn(),
}));

jest.mock('@/lib/auth/step-up.server', () => ({
  assertRecentStepUp: jest.fn(),
}));

jest.mock('@/lib/supabase/route-handler-client', () => ({
  createRouteHandlerSupabaseClient: jest.fn(),
}));

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    user_mfa_recovery_codes: {
      deleteMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/audit/auth-audit.server', () => ({
  recordAuthAuditEvent: jest.fn(),
}));

jest.mock('@/lib/auth/session-revoke.server', () => ({
  revokeUserSessions: jest.fn(),
}));

jest.mock('@/lib/auth/sensitive-action-notify.server', () => ({
  notifyAccountSecurityEvent: jest.fn(),
}));

import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { assertRecentStepUp } from '@/lib/auth/step-up.server';
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/route-handler-client';
import { POST } from '@/app/api/security/mfa/unenroll/route';

const authMock = getCurrentUserForApi as jest.Mock;
const stepUpMock = assertRecentStepUp as jest.Mock;
const supabaseMock = createRouteHandlerSupabaseClient as jest.Mock;
const unenroll = jest.fn();

function request(body: unknown) {
  return new NextRequest('http://localhost/api/security/mfa/unenroll', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/security/mfa/unenroll', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'owner@example.com' },
      response: null,
    });
    supabaseMock.mockResolvedValue({
      auth: { mfa: { unenroll } },
    });
  });

  it('does not disable 2FA without recent TOTP step-up', async () => {
    stepUpMock.mockResolvedValue({
      ok: false,
      code: 'STEP_UP_REQUIRED',
      response: NextResponse.json(
        {
          error: 'Enter the 6-digit code from your authenticator app to confirm this action.',
          code: 'STEP_UP_REQUIRED',
        },
        { status: 403 }
      ),
    });

    const response = await POST(request({ factorId: 'factor-1' }));
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('STEP_UP_REQUIRED');
    expect(unenroll).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated disable attempt', async () => {
    authMock.mockResolvedValue({
      user: null,
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    });
    const response = await POST(request({ factorId: 'factor-1' }));
    expect(response.status).toBe(401);
    expect(stepUpMock).not.toHaveBeenCalled();
    expect(unenroll).not.toHaveBeenCalled();
  });

  it('disables 2FA after recent step-up', async () => {
    stepUpMock.mockResolvedValue({ ok: true });
    unenroll.mockResolvedValue({ error: null });
    const response = await POST(request({ factorId: 'factor-1' }));
    expect(response.status).toBe(200);
    expect(unenroll).toHaveBeenCalledWith({ factorId: 'factor-1' });
  });
});
