import { NextRequest, NextResponse } from 'next/server';
import {
  hasPkceCodeVerifierCookie,
  mergeAuthCookieLists,
  sanitizeAuthCookieOptions,
} from '@/lib/auth/auth-cookie-storage';
import { buildParticipantMagicLinkRedirectTo } from '@/lib/participant-portal/participant-magic-link';
import { resolveParticipantAuthOrigin } from '@/lib/runtime/customer-facing-url';

const TOKEN = '9c1e725e-45fd-4456-bf45-db4d710addf4';
const VERIFIER_COOKIE = 'sb-kjcqsdvwemxmzlwoqqmx-auth-token-code-verifier';
const PARTICIPANT = {
  id: 'participant-user',
  email: 'jaynealisha77@gmail.com',
  email_confirmed_at: '2026-08-21T00:00:00Z',
  app_metadata: { provider: 'email' },
};

const mockExchangeCodeForSession = jest.fn();
const mockGetUser = jest.fn();
const mockFindParticipantByPortalToken = jest.fn();
const mockCapturedGetAll = jest.fn();

jest.mock('@/lib/supabase/route-handler-client', () => ({
  createAuthCookieBuffer: () => ({
    cookies: [],
    names: () => [],
    applyTo: (response: NextResponse) => response,
  }),
  createRequestBoundSupabaseClient: jest.fn((request: NextRequest) => {
    mockCapturedGetAll(request.cookies.getAll());
    return {
      auth: {
        exchangeCodeForSession: mockExchangeCodeForSession,
        getUser: mockGetUser,
      },
    };
  }),
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

function renderProxyRequest(url: string, extraHeaders: Record<string, string> = {}) {
  return new NextRequest(url, {
    headers: {
      host: 'localhost:10000',
      'x-forwarded-proto': 'https',
      'x-forwarded-host': extraHeaders['x-forwarded-host'] ?? 'www.provvypay.com',
      ...extraHeaders,
    },
  });
}

describe('PKCE cookie storage', () => {
  it('reads the code-verifier cookie that send-link set on the request', () => {
    const merged = mergeAuthCookieLists(
      [{ name: VERIFIER_COOKIE, value: 'pkce-verifier' }],
      []
    );
    expect(hasPkceCodeVerifierCookie(merged)).toBe(true);
    expect(merged.find((cookie) => cookie.name === VERIFIER_COOKIE)?.value).toBe('pkce-verifier');
  });

  it('strips Domain=localhost so the browser can store the verifier on the public host', () => {
    process.env.NODE_ENV = 'production';
    const options = sanitizeAuthCookieOptions({
      domain: 'localhost',
      path: '/',
      sameSite: 'lax',
    });
    expect(options.domain).toBeUndefined();
    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe('lax');
  });
});

describe('participant magic-link origin under a Render proxy', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'production';
    process.env.RENDER = 'true';
    process.env.NEXT_PUBLIC_APP_URL = 'https://www.provvypay.com';
    delete process.env.ALLOW_INFRASTRUCTURE_DOMAINS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('builds emailRedirectTo on the canonical public origin, not localhost or onrender', () => {
    const origin = resolveParticipantAuthOrigin(
      renderProxyRequest('https://localhost:10000/api/participant-portal/x/auth/send-link', {
        origin: 'https://www.provvypay.com',
        'x-forwarded-host': 'provvypay-api.onrender.com',
      })
    );
    const emailRedirectTo = buildParticipantMagicLinkRedirectTo(origin, TOKEN);

    expect(emailRedirectTo).toBe(
      `https://www.provvypay.com/auth/callback?next=${encodeURIComponent(`/participant/${TOKEN}`)}`
    );
    expect(emailRedirectTo).not.toMatch(/localhost/i);
    expect(emailRedirectTo).not.toContain('onrender.com');
  });
});

describe('participant PKCE callback behind Render proxy headers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'production';
    process.env.RENDER = 'true';
    process.env.NEXT_PUBLIC_APP_URL = 'https://www.provvypay.com';
    mockFindParticipantByPortalToken.mockResolvedValue({
      participantEmail: 'jaynealisha77@gmail.com',
      authenticatedUserId: null,
      dealUserId: 'owner-user',
    });
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: PARTICIPANT, session: { user: PARTICIPANT } },
      error: null,
    });
    mockGetUser.mockResolvedValue({ data: { user: PARTICIPANT }, error: null });
  });

  it('exchanges the auth code using the incoming PKCE cookie and redirects to /participant/:id', async () => {
    const request = renderProxyRequest(
      `https://localhost:10000/auth/callback?code=participant-otp-code&next=${encodeURIComponent(`/participant/${TOKEN}`)}`,
      {
        cookie: `${VERIFIER_COOKIE}=pkce-verifier`,
        'x-forwarded-host': 'www.provvypay.com',
      }
    );

    expect(hasPkceCodeVerifierCookie(request.cookies.getAll())).toBe(true);

    const response = await authCallback(request);

    expect(mockCapturedGetAll).toHaveBeenCalled();
    const cookiesSeen = mockCapturedGetAll.mock.calls[0][0] as Array<{ name: string; value: string }>;
    expect(hasPkceCodeVerifierCookie(cookiesSeen)).toBe(true);
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('participant-otp-code');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(`https://www.provvypay.com/participant/${TOKEN}`);
    expect(response.headers.get('location')).not.toMatch(/localhost/i);
  });
});
