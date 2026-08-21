import { NextRequest } from 'next/server';

const mockExchangeCodeForSession = jest.fn();
const mockVerifyOtp = jest.fn();
const mockGetUser = jest.fn();
const mockFindParticipantByPortalToken = jest.fn();

jest.mock('@/lib/supabase/route-handler-client', () => ({
  createAuthCookieBuffer: () => ({
    cookies: [],
    names: () => [],
    applyTo: (response: { cookies?: { set?: unknown } }) => response,
  }),
  createRequestBoundSupabaseClient: jest.fn(() => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
      verifyOtp: mockVerifyOtp,
      getUser: mockGetUser,
    },
  })),
}));

jest.mock('@/lib/participant-portal/participant-portal.server', () => ({
  findParticipantByPortalToken: (...args: unknown[]) => mockFindParticipantByPortalToken(...args),
  resolveParticipantAuthDestinationForUser: jest.fn(),
}));

jest.mock('@/lib/audit/auth-audit.server', () => ({
  recordAuthAuditEvent: jest.fn(),
}));

jest.mock('@/lib/auth/login-tracking.server', () => ({
  recordSuccessfulLogin: jest.fn(),
}));

jest.mock('@/lib/runtime/customer-facing-url', () => ({
  resolveCanonicalPublicOrigin: () => 'https://www.provvypay.com',
  resolveParticipantAuthOrigin: () => 'https://www.provvypay.com',
  toAuthAppPath: (path: string) => (path.startsWith('/') ? path : `/${path}`),
}));

jest.mock('@/lib/logger', () => ({
  loggers: {
    auth: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  },
}));

import { GET as authCallback } from '@/app/auth/callback/route';

const TOKEN = '9c1e725e-45fd-4456-bf45-db4d710addf4';
const RETURN_PATH = `/participant/${TOKEN}`;
const PARTICIPANT = {
  id: 'participant-user',
  email: 'jaynealisha77@gmail.com',
  email_confirmed_at: '2026-08-21T00:00:00Z',
  app_metadata: { provider: 'email' },
};

function callbackRequest(search: Record<string, string>) {
  const url = new URL('https://provvypay-api.onrender.com/auth/callback');
  for (const [key, value] of Object.entries(search)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

describe('participant recovery callback route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindParticipantByPortalToken.mockResolvedValue({
      participantEmail: 'jaynealisha77@gmail.com',
      authenticatedUserId: null,
      dealUserId: 'owner-user',
    });
  });

  it('does not send the browser to /participant until a code is exchanged', async () => {
    const response = await authCallback(
      callbackRequest({ next: RETURN_PATH })
    );

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      `https://www.provvypay.com/auth/callback/complete?next=${encodeURIComponent(RETURN_PATH)}`
    );
  });

  it('persists the invited session after a successful participant exchange and then redirects to the workspace', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: PARTICIPANT, session: { user: PARTICIPANT } },
      error: null,
    });
    mockGetUser.mockResolvedValue({ data: { user: PARTICIPANT }, error: null });

    const response = await authCallback(
      callbackRequest({ code: 'participant-otp-code', next: RETURN_PATH })
    );

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('participant-otp-code');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      `https://www.provvypay.com${RETURN_PATH}`
    );
  });

  it('does not redirect to the participant workspace when the exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'invalid code verifier' },
    });

    const response = await authCallback(
      callbackRequest({ code: 'stale-code', next: RETURN_PATH })
    );

    expect(response.headers.get('location')).toBe(
      `https://www.provvypay.com/auth/callback/complete?next=${encodeURIComponent(RETURN_PATH)}&error=exchange_failed`
    );
  });
});
