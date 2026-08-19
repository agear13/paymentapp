'use client';

import type { SupabaseClient } from '@supabase/supabase-js';

export type SignOutClientOptions = {
  supabase: SupabaseClient;
  onBeforeRedirect?: () => void;
  confirm?: boolean;
};

/**
 * Shared sign-out flow used by dashboard sidebar and Commercial OS account menu.
 * This only clears the current browser session. High-risk credential changes
 * must call `revokeUserSessions` on the server (global or others).
 */
export async function signOutClient({
  supabase,
  onBeforeRedirect,
  confirm = true,
}: SignOutClientOptions): Promise<{ ok: true } | { ok: false; error: string }> {
  if (confirm && typeof window !== 'undefined' && !window.confirm('Are you sure you want to sign out?')) {
    return { ok: false, error: 'cancelled' };
  }

  try {
    localStorage.clear();

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    const email = sessionData.session?.user.email ?? undefined;

    await supabase.auth.signOut();

    void fetch('/api/auth/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'auth.logout',
        userId,
        email,
      }),
      keepalive: true,
    }).catch(() => undefined);

    onBeforeRedirect?.();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sign out';
    return { ok: false, error: message };
  }
}
