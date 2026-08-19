import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { log } from '@/lib/logger';

export type SessionRevokeScope = 'global' | 'local' | 'others';

/**
 * Revoke Supabase refresh sessions server-side.
 * Client `signOut()` only clears the current browser.
 */
export async function revokeUserSessions(
  userId: string,
  scope: SessionRevokeScope = 'global'
): Promise<{ ok: boolean; error?: string }> {
  if (!userId) {
    return { ok: false, error: 'userId required' };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.signOut(userId, scope);
    if (error) {
      log.warn('Failed to revoke user sessions', {
        userId,
        scope,
        message: error.message,
      });
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'session_revoke_failed';
    log.warn('Session revocation threw', { userId, scope, message });
    return { ok: false, error: message };
  }
}
