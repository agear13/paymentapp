/** @jest-environment jsdom */

import { signOutParticipantSession } from '@/lib/participant-portal/participant-sign-out.client';

const mockSignOut = jest.fn();
const mockGetSession = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: mockSignOut,
      getSession: mockGetSession,
    },
  }),
}));

jest.mock('@/lib/security/csrf-fetch.client', () => ({
  csrfAwareFetch: jest.fn().mockResolvedValue({ ok: true }),
}));

const { csrfAwareFetch } = jest.requireMock('@/lib/security/csrf-fetch.client') as {
  csrfAwareFetch: jest.Mock;
};

describe('signOutParticipantSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignOut.mockResolvedValue({ error: null });
    mockGetSession.mockResolvedValue({ data: { session: null } });
    localStorage.setItem('keep-me', '1');
  });

  it('signs out locally, hits the server sign-out route, and does not wipe localStorage', async () => {
    const result = await signOutParticipantSession();
    expect(result).toEqual({ ok: true });
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(csrfAwareFetch).toHaveBeenCalledWith('/api/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
    });
    expect(localStorage.getItem('keep-me')).toBe('1');
  });

  it('retries local sign-out if a session is still present', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'operator' } } } });
    await signOutParticipantSession();
    expect(mockSignOut).toHaveBeenCalledTimes(2);
  });
});
