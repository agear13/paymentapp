/** @jest-environment jsdom */

import { signOutClient } from '@/lib/auth/sign-out.client';

describe('signOutClient', () => {
  beforeEach(() => {
    localStorage.setItem('test-key', 'value');
    window.confirm = jest.fn(() => true);
  });

  it('clears storage, signs out, audits, and redirects', async () => {
    const signOut = jest.fn().mockResolvedValue(undefined);
    const getSession = jest.fn().mockResolvedValue({
      data: { session: { user: { id: 'user-1', email: 'test@example.com' } } },
    });
    const onBeforeRedirect = jest.fn();

    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as jest.Mock;

    const result = await signOutClient({
      supabase: { auth: { getSession, signOut } } as never,
      onBeforeRedirect,
      confirm: true,
    });

    expect(result).toEqual({ ok: true });
    expect(localStorage.length).toBe(0);
    expect(signOut).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/audit',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('auth.logout'),
      })
    );
    expect(onBeforeRedirect).toHaveBeenCalled();
  });

  it('returns cancelled when user declines confirm', async () => {
    window.confirm = jest.fn(() => false);

    const result = await signOutClient({
      supabase: { auth: { signOut: jest.fn() } } as never,
    });

    expect(result).toEqual({ ok: false, error: 'cancelled' });
  });
});
