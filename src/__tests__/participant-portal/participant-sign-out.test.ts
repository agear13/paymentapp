/** @jest-environment jsdom */

import {
  participantWorkspaceEntryPath,
  reloadParticipantInvitation,
  signOutParticipantSession,
} from '@/lib/participant-portal/participant-sign-out.client';

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

describe('participant workspace re-entry after logout', () => {
  it('returns to the same participant URL with a signed-out flag', () => {
    expect(participantWorkspaceEntryPath('portal-1', { signedOut: true })).toBe(
      '/participant/portal-1?signedOut=1'
    );
    expect(participantWorkspaceEntryPath('portal-1', { recover: true })).toBe(
      '/participant/portal-1?recover=1'
    );
  });

  it('reloads the invitation URL after logout instead of a generic homepage', () => {
    const replace = jest.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { replace },
    });
    reloadParticipantInvitation('portal-1');
    expect(replace).toHaveBeenCalledWith('/participant/portal-1?signedOut=1');
    reloadParticipantInvitation('portal-1', true);
    expect(replace).toHaveBeenCalledWith('/participant/portal-1?recover=1');
  });
});
