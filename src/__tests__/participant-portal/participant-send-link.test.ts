import { NextRequest } from 'next/server';

const mockSignInWithOtp = jest.fn();
const mockSignOut = jest.fn();
const mockFindParticipantByPortalToken = jest.fn();
const mockGetParticipantSessionUser = jest.fn();

jest.mock('@/lib/rate-limit', () => ({
  applyRateLimit: jest.fn(async () => ({ success: true, limit: 10, remaining: 9, reset: 0 })),
}));

jest.mock('@/lib/security/csrf', () => ({
  enforceCsrfForRequest: jest.fn(() => null),
}));

jest.mock('@/lib/supabase/route-handler-client', () => ({
  createAuthCookieBuffer: () => ({
    cookies: [],
    names: () => [],
    applyTo: (response: { cookies: { set: jest.Mock } }) => response,
  }),
  createRequestBoundSupabaseClient: jest.fn(() => ({
    auth: {
      signInWithOtp: mockSignInWithOtp,
      signOut: mockSignOut,
    },
  })),
}));

jest.mock('@/lib/participant-portal/participant-portal.server', () => ({
  findParticipantByPortalToken: (...args: unknown[]) => mockFindParticipantByPortalToken(...args),
}));

jest.mock('@/lib/participant-portal/participant-session.server', () => ({
  getParticipantSessionUser: (...args: unknown[]) => mockGetParticipantSessionUser(...args),
}));

jest.mock('@/lib/runtime/customer-facing-url', () => ({
  resolveCanonicalPublicOrigin: () => 'https://provvypay-api.onrender.com',
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

import { POST as sendParticipantLink } from '@/app/api/participant-portal/[token]/auth/send-link/route';

const TOKEN = '9c1e725e-45fd-4456-bf45-db4d710addf4';
const PARTICIPANT = { id: 'participant-user', email: 'jaynealisha77@gmail.com' };
const OPERATOR = { id: 'operator-user', email: 'alishajaynegeary@gmail.com' };

function sendRequest() {
  return new NextRequest(
    `https://provvypay-api.onrender.com/api/participant-portal/${TOKEN}/auth/send-link`,
    { method: 'POST' }
  );
}

describe('participant recovery send-link', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignOut.mockResolvedValue({ error: null });
    mockSignInWithOtp.mockResolvedValue({ error: null });
    mockFindParticipantByPortalToken.mockResolvedValue({
      participantEmail: 'jaynealisha77@gmail.com',
      authenticatedUserId: null,
      dealUserId: 'owner-user',
    });
  });

  it('signs out a leftover operator session before sending the invited OTP', async () => {
    mockGetParticipantSessionUser.mockResolvedValue(OPERATOR);

    const response = await sendParticipantLink(sendRequest(), {
      params: Promise.resolve({ token: TOKEN }),
    });

    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'jaynealisha77@gmail.com',
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `https://provvypay-api.onrender.com/auth/callback?next=${encodeURIComponent(`/participant/${TOKEN}`)}`,
      },
    });
    const body = await response.json();
    expect(body.emailRedirectTo).toBe(
      `https://provvypay-api.onrender.com/auth/callback?next=${encodeURIComponent(`/participant/${TOKEN}`)}`
    );
    expect(response.status).toBe(200);
  });

  it('does not sign out after recover when no session remains', async () => {
    mockGetParticipantSessionUser.mockResolvedValue(null);

    await sendParticipantLink(sendRequest(), {
      params: Promise.resolve({ token: TOKEN }),
    });

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockSignInWithOtp).toHaveBeenCalled();
  });

  it('does not sign out an already-authenticated invited participant', async () => {
    mockGetParticipantSessionUser.mockResolvedValue(PARTICIPANT);

    await sendParticipantLink(sendRequest(), {
      params: Promise.resolve({ token: TOKEN }),
    });

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockSignInWithOtp).toHaveBeenCalled();
  });
});
