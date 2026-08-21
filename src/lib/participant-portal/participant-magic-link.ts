import {
  isSafeParticipantReturnPath,
  participantWorkspaceReturnPath,
} from '@/lib/participant-portal/participant-auth-return';

export const PARTICIPANT_AUTH_CALLBACK_PATH = '/auth/callback';
export const PARTICIPANT_AUTH_CALLBACK_COMPLETE_PATH = '/auth/callback/complete';

/**
 * Production Supabase Auth → Redirect URLs must include the callback, not only
 * Site URL or localhost. Query strings are not reliably preserved unless the
 * allowlist covers this path (exact URL, `/auth/callback**`, or `/**`).
 */
export function supabaseAuthRedirectAllowlistHints(origin: string): string[] {
  const base = origin.replace(/\/$/, '');
  return [
    `${base}${PARTICIPANT_AUTH_CALLBACK_PATH}`,
    `${base}${PARTICIPANT_AUTH_CALLBACK_PATH}/**`,
    `${base}/auth/**`,
    `${base}/**`,
  ];
}

/** Magic-link emailRedirectTo. The participant page is not the auth handler. */
export function buildParticipantMagicLinkRedirectTo(origin: string, token: string): string {
  const next = participantWorkspaceReturnPath(token);
  return `${origin.replace(/\/$/, '')}${PARTICIPANT_AUTH_CALLBACK_PATH}?next=${encodeURIComponent(next)}`;
}

export function hashContainsAuthParams(hash: string): boolean {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return false;
  const params = new URLSearchParams(raw);
  return Boolean(
    params.get('access_token') ||
      params.get('refresh_token') ||
      params.get('error') ||
      params.get('token_hash')
  );
}

export function searchContainsAuthParams(search: string): boolean {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  if (!raw) return false;
  const params = new URLSearchParams(raw);
  return Boolean(params.get('code') || params.get('token_hash'));
}

export function participantUrlNeedsAuthCallback(search: string, hash: string): boolean {
  return searchContainsAuthParams(search) || hashContainsAuthParams(hash);
}

/**
 * Forward misplaced auth params from /participant/{token} to /auth/callback.
 * Does not exchange the session here — the gate is not the callback handler.
 */
export function buildAuthCallbackForwardUrl(input: {
  participantPath: string;
  search: string;
  hash: string;
}): string {
  const next = input.participantPath.split('?')[0] || '/';
  const search = new URLSearchParams(
    input.search.startsWith('?') ? input.search.slice(1) : input.search
  );
  const dest = new URLSearchParams();
  dest.set('next', next);
  const code = search.get('code');
  const tokenHash = search.get('token_hash');
  const type = search.get('type');
  if (code) dest.set('code', code);
  if (tokenHash) dest.set('token_hash', tokenHash);
  if (type) dest.set('type', type);

  const path = code || tokenHash ? PARTICIPANT_AUTH_CALLBACK_PATH : PARTICIPANT_AUTH_CALLBACK_COMPLETE_PATH;
  const hash = input.hash && !input.hash.startsWith('#') ? `#${input.hash}` : input.hash;
  return `${path}?${dest.toString()}${hash || ''}`;
}

export function safeCallbackNextPath(
  next: string | null | undefined,
  redirectedFrom: string | null | undefined,
  cookieReturn: string | null | undefined
): string | null {
  if (isSafeParticipantReturnPath(next)) return next;
  if (isSafeParticipantReturnPath(redirectedFrom)) return redirectedFrom;
  if (isSafeParticipantReturnPath(cookieReturn)) return cookieReturn;
  return null;
}
