import { NextRequest } from 'next/server';
import { GENERIC_VERIFICATION_RESEND_RESPONSE } from '@/lib/auth/auth-errors';

jest.mock('@/lib/audit/auth-audit.server', () => ({
  recordAuthAuditEvent: jest.fn(),
}));

jest.mock('@/lib/auth/session', () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock('@/lib/auth/api-session.server', () => ({
  getCurrentUserForApi: jest.fn(),
}));

jest.mock('@/lib/auth/auth-rate-limit.server', () => ({
  checkResendVerificationRateLimit: jest.fn(),
  getVerificationResendCooldownRemaining: jest.fn(),
  setVerificationResendCooldown: jest.fn(),
  rateLimit429Response: jest.fn((message: string, retryAfterSeconds: number) => {
    return new Response(JSON.stringify({ error: message, retryAfterSeconds }), { status: 429 });
  }),
  RESEND_COOLDOWN_SECONDS: 60,
  verificationResendIdentity: jest.fn(
    ({ userId, email }: { userId?: string | null; email?: string | null }) =>
      userId ?? (email ? `email:${email}` : 'anonymous')
  ),
}));

jest.mock('@/lib/supabase/route-handler-client', () => ({
  createRouteHandlerSupabaseClient: jest.fn(),
  resolveAuthRedirectOrigin: jest.fn(() => 'http://localhost:3000'),
}));

import { GET, POST } from '@/app/api/auth/resend-verification/route';
import { getCurrentUser } from '@/lib/auth/session';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import {
  checkResendVerificationRateLimit,
  getVerificationResendCooldownRemaining,
  setVerificationResendCooldown,
} from '@/lib/auth/auth-rate-limit.server';
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/route-handler-client';

const mockGetCurrentUser = getCurrentUser as jest.Mock;
const mockGetCurrentUserForApi = getCurrentUserForApi as jest.Mock;
const mockCheckResend = checkResendVerificationRateLimit as jest.Mock;
const mockGetCooldown = getVerificationResendCooldownRemaining as jest.Mock;
const mockSetCooldown = setVerificationResendCooldown as jest.Mock;
const mockCreateClient = createRouteHandlerSupabaseClient as jest.Mock;

const EMAIL = 'operator@company.com';

function jsonRequest(body?: unknown) {
  return new NextRequest('http://localhost/api/auth/resend-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function mockResend(error: unknown = null) {
  const resend = jest.fn().mockResolvedValue({ error });
  mockCreateClient.mockResolvedValue({ auth: { resend } });
  return resend;
}

describe('POST /api/auth/resend-verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCooldown.mockResolvedValue(0);
    mockCheckResend.mockResolvedValue({ allowed: true });
    mockSetCooldown.mockResolvedValue(undefined);
    mockGetCurrentUserForApi.mockResolvedValue({ user: null, response: { status: 401 } });
    mockGetCurrentUser.mockResolvedValue(null);
  });

  it('resends without a session and returns a generic success payload', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const resend = mockResend();

    const response = await POST(jsonRequest({ email: EMAIL }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.message).toBe(GENERIC_VERIFICATION_RESEND_RESPONSE);
    expect(body.retryAfterSeconds).toBe(60);
    expect(resend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'signup',
        email: EMAIL,
        options: {
          emailRedirectTo:
            'http://localhost:3000/auth/callback?type=signup&redirectedFrom=%2Fjourney%2Fprovisioning%3Fbuild%3D1',
        },
      })
    );
    expect(mockSetCooldown).toHaveBeenCalled();
  });

  it('does not reveal whether the address exists when GoTrue returns not found', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    mockResend({ message: 'User not found', code: 'user_not_found' });

    const response = await POST(jsonRequest({ email: EMAIL }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe(GENERIC_VERIFICATION_RESEND_RESPONSE);
    expect(body.error).toBeUndefined();
  });

  it('treats already-verified addresses as success for signed-in users', async () => {
    mockGetCurrentUserForApi.mockResolvedValue({
      user: { id: 'user-1', email: EMAIL },
      response: null,
    });
    mockResend({ message: 'Email already confirmed' });

    const response = await POST(jsonRequest({ email: EMAIL }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('enforces cooldown without leaking account existence', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    mockGetCooldown.mockResolvedValue(42);

    const response = await POST(jsonRequest({ email: EMAIL }));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.retryAfterSeconds).toBe(42);
    expect(body.error).toMatch(/42 seconds/i);
  });

  it('requires an email when there is no session', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await POST(jsonRequest({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/email/i);
  });
});

describe('GET /api/auth/resend-verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns zero cooldown for signed-out visitors', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.cooldownRemaining).toBe(0);
  });

  it('returns remaining cooldown for a signed-in unverified user', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', email: EMAIL });
    mockGetCooldown.mockResolvedValue(17);
    const response = await GET();
    const body = await response.json();
    expect(body.cooldownRemaining).toBe(17);
  });
});
