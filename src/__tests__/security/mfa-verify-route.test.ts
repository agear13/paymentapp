import { NextRequest, NextResponse } from 'next/server';

jest.mock('@/lib/auth/api-session.server', () => ({
  getCurrentUserForApi: jest.fn(),
}));

jest.mock('@/lib/auth/auth-rate-limit.server', () => ({
  checkMfaVerifyRateLimit: jest.fn(),
  rateLimit429Response: jest.fn(),
}));

jest.mock('@/lib/supabase/route-handler-client', () => ({
  createRouteHandlerSupabaseClient: jest.fn(),
}));

jest.mock('@/lib/audit/auth-audit.server', () => ({
  recordAuthAuditEvent: jest.fn(),
}));

jest.mock('@/lib/auth/mfa.server', () => ({
  replaceRecoveryCodes: jest.fn(),
}));

import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { checkMfaVerifyRateLimit } from '@/lib/auth/auth-rate-limit.server';
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/route-handler-client';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';
import { POST } from '@/app/api/security/mfa/verify/route';

const authMock = getCurrentUserForApi as jest.Mock;
const rateLimitMock = checkMfaVerifyRateLimit as jest.Mock;
const supabaseMock = createRouteHandlerSupabaseClient as jest.Mock;
const auditMock = recordAuthAuditEvent as jest.Mock;
const verify = jest.fn();

function request(body: unknown) {
  return new NextRequest('http://localhost/api/security/mfa/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/security/mfa/verify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'owner@example.com' },
      response: null,
    });
    rateLimitMock.mockResolvedValue({ allowed: true });
    supabaseMock.mockResolvedValue({
      auth: { mfa: { verify } },
    });
  });

  it('verifies a valid TOTP challenge for step-up', async () => {
    verify.mockResolvedValue({ error: null });
    const response = await POST(
      request({
        factorId: 'factor-1',
        challengeId: 'challenge-1',
        code: '123456',
        purpose: 'step-up',
      })
    );
    expect(response.status).toBe(200);
    expect(verify).toHaveBeenCalledWith({
      factorId: 'factor-1',
      challengeId: 'challenge-1',
      code: '123456',
    });
    expect(JSON.stringify(auditMock.mock.calls)).not.toContain('123456');
  });

  it('rejects an invalid code without exposing the secret', async () => {
    verify.mockResolvedValue({ error: { message: 'Invalid TOTP code entered' } });
    const response = await POST(
      request({
        factorId: 'factor-1',
        challengeId: 'challenge-1',
        code: '000000',
        purpose: 'step-up',
      })
    );
    const json = await response.json();
    expect(response.status).toBe(401);
    expect(json.error).toBe('Invalid authenticator code.');
    expect(JSON.stringify(json)).not.toMatch(/secret|otpauth|000000/i);
  });

  it('marks an expired challenge so the client can start a new one', async () => {
    verify.mockResolvedValue({ error: { message: 'Challenge has expired or already used' } });
    const response = await POST(
      request({
        factorId: 'factor-1',
        challengeId: 'challenge-old',
        code: '123456',
        purpose: 'step-up',
      })
    );
    const json = await response.json();
    expect(response.status).toBe(401);
    expect(json.code).toBe('MFA_CHALLENGE_EXPIRED');
    expect(json.error).toMatch(/expired/i);
  });

  it('rejects an unauthorized verify attempt', async () => {
    authMock.mockResolvedValue({
      user: null,
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    });
    const response = await POST(
      request({
        factorId: 'factor-1',
        challengeId: 'challenge-1',
        code: '123456',
      })
    );
    expect(response.status).toBe(401);
    expect(verify).not.toHaveBeenCalled();
  });
});
