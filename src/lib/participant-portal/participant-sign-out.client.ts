'use client';

import { createClient } from '@/lib/supabase/client';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import { participantWorkspaceReturnPath } from '@/lib/participant-portal/participant-auth-return';

/**
 * Sign out the current browser Supabase session and stay on the invitation URL.
 * Does not redirect to /auth/login, /workspace, or /onboarding.
 * Does not wipe localStorage (that would destroy an in-flight PKCE verifier).
 */
export async function signOutParticipantSession(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = createClient();
    await supabase.auth.signOut({ scope: 'local' });
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      await supabase.auth.signOut({ scope: 'local' });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sign out';
    return { ok: false, error: message };
  }

  try {
    await csrfAwareFetch('/api/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // Client cookies may already be gone; server route is belt-and-suspenders.
  }

  return { ok: true };
}

export function participantWorkspaceEntryPath(
  token: string,
  query?: { recover?: boolean; signedOut?: boolean }
): string {
  const path = participantWorkspaceReturnPath(token);
  const params = new URLSearchParams();
  if (query?.recover) params.set('recover', '1');
  if (query?.signedOut) params.set('signedOut', '1');
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export function reloadParticipantInvitation(token: string, recoveredFromWrongAccount = false): void {
  window.location.replace(
    participantWorkspaceEntryPath(token, recoveredFromWrongAccount
      ? { recover: true }
      : { signedOut: true })
  );
}
