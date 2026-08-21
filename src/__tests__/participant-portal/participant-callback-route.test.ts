import { NextRequest } from 'next/server';

const mockExchangeCodeForSession = jest.fn();
const mockGetUser = jest.fn();
const mockSignOut = jest.fn();
const mockFindParticipantByPortalToken = jest.fn();

jest.mock('@/lib/supabase/route-handler-client', () => ({
  createRouteHandlerSupabaseClient: jest.fn(async () => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
      getUser: mockGetUser,
      signOut: mockSignOut,
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
  resolveCanonicalPublicOrigin: () => 'https://app.example.com',
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
const OPERATOR = {
  id: 'operator-user',
  email: 'alishajaynegeary@gmail.com',
  email_confirmed_at: '2026-08-21T00:00:00Z',
  app_metadata: { provider: 'email' },
};

function callbackRequest() {
  const url = new URL('https://app.example.com/auth/callback');
  url.searchParams.set('code', 'participant-otp-code');
  url.searchParams.set('redirectedFrom', RETURN_PATH);
  return new NextRequest(url);
}

describe('participant recovery callback route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignOut.mockResolvedValue({ error: null });
    mockFindParticipantByPortalToken.mockResolvedValue({
      participantEmail: 'jaynealisha77@gmail.com',
      authenticatedUserId: null,
      dealUserId: 'owner-user',
    });
  });

  it('persists the invited session and does not sign out after a successful participant exchange', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: PARTICIPANT, session: { user: PARTICIPANT } },
      error: null,
    });
    mockGetUser.mockResolvedValue({ data: { user: PARTICIPANT }, error: null });

    const response = await authCallback(callbackRequest());

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('participant-otp-code');
    expect(mockGetUser).toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(`https://app.example.com${RETURN_PATH}`);
  });

  it('does not sign out the new participant when getUser() still sees leftover operator cookies', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: PARTICIPANT, session: { user: PARTICIPANT } },
      error: null,
    });
    mockGetUser.mockResolvedValue({ data: { user: OPERATOR }, error: null });

    const response = await authCallback(callbackRequest());

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBe(`https://app.example.com${RETURN_PATH}`);
  });

  it('signs out leftover operator cookies only when the exchange failed', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'expired' },
    });
    mockGetUser.mockResolvedValue({ data: { user: OPERATOR }, error: null });

    const response = await authCallback(callbackRequest());

    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(response.headers.get('location')).toBe(`https://app.example.com${RETURN_PATH}`);
  });
});
