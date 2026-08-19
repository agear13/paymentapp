jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  log: { warn: jest.fn(), info: jest.fn() },
}));

import { createAdminClient } from '@/lib/supabase/admin';
import { revokeUserSessions } from '@/lib/auth/session-revoke.server';

const mockCreateAdminClient = createAdminClient as jest.Mock;

describe('revokeUserSessions', () => {
  it('uses Supabase admin global signOut rather than a client-only logout', async () => {
    const signOut = jest.fn().mockResolvedValue({ error: null });
    mockCreateAdminClient.mockReturnValue({
      auth: { admin: { signOut } },
    });

    const result = await revokeUserSessions('user-1', 'global');

    expect(result.ok).toBe(true);
    expect(signOut).toHaveBeenCalledWith('user-1', 'global');
  });

  it('can revoke other sessions while keeping the current one', async () => {
    const signOut = jest.fn().mockResolvedValue({ error: null });
    mockCreateAdminClient.mockReturnValue({
      auth: { admin: { signOut } },
    });

    await revokeUserSessions('user-1', 'others');
    expect(signOut).toHaveBeenCalledWith('user-1', 'others');
  });
});
