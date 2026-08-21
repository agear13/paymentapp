/**
 * Preserve participant invitation context across Supabase magic-link auth.
 * Query params on emailRedirectTo are not reliable; cookie + allowlisted path
 * are the durable return channel. Never accept an open redirect.
 */

export const PARTICIPANT_AUTH_RETURN_COOKIE = 'provvy_participant_auth_return';
export const PARTICIPANT_WORKSPACE_CHOOSER_PATH = '/participant/workspaces';
export const PARTICIPANT_AUTH_RETURN_MAX_AGE_SECONDS = 20 * 60;

const PARTICIPANT_PATH = /^\/participant\/[A-Za-z0-9._~-]+$/;

export function participantWorkspaceReturnPath(token: string): string {
  return `/participant/${token.trim()}`;
}

export function participantTokenFromReturnPath(path: string | null | undefined): string | null {
  if (!isSafeParticipantReturnPath(path)) return null;
  try {
    const parsed = new URL(path, 'https://provvy.invalid');
    const token = parsed.pathname.replace(/^\/participant\//, '').trim();
    return token || null;
  } catch {
    return null;
  }
}

export function isSafeInternalRedirectPath(path: string | null | undefined): path is string {
  if (!path) return false;
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return false;
  if (path.includes('://')) return false;
  return true;
}

export function isSafeParticipantReturnPath(path: string | null | undefined): path is string {
  if (!isSafeInternalRedirectPath(path)) return false;
  try {
    const parsed = new URL(path, 'https://provvy.invalid');
    if (!PARTICIPANT_PATH.test(parsed.pathname)) return false;
    const step = parsed.searchParams.get('step');
    if (step && step !== 'payout') return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Identity fallback may only restore a workspace when exactly one authorised
 * destination exists. Never pick an arbitrary first/newest match.
 */
export function uniqueAuthorizedParticipantReturnPath(
  paths: Array<string | null | undefined>
): string | null {
  const unique = collectUniqueParticipantPathnames(paths);
  return unique.length === 1 ? unique[0] : null;
}

export type ParticipantAuthDestination =
  | { kind: 'unique'; path: string }
  | { kind: 'chooser'; path: typeof PARTICIPANT_WORKSPACE_CHOOSER_PATH }
  | { kind: 'none' };

export function resolveAuthorizedParticipantDestination(
  paths: Array<string | null | undefined>
): ParticipantAuthDestination {
  const unique = collectUniqueParticipantPathnames(paths);
  if (unique.length === 1) return { kind: 'unique', path: unique[0] };
  if (unique.length > 1) {
    return { kind: 'chooser', path: PARTICIPANT_WORKSPACE_CHOOSER_PATH };
  }
  return { kind: 'none' };
}

function collectUniqueParticipantPathnames(paths: Array<string | null | undefined>): string[] {
  const unique = new Set<string>();
  for (const path of paths) {
    if (!isSafeParticipantReturnPath(path)) continue;
    try {
      unique.add(new URL(path, 'https://provvy.invalid').pathname);
    } catch {
      continue;
    }
  }
  return [...unique];
}

export function participantAuthReturnCookieOptions(clear?: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: clear ? 0 : PARTICIPANT_AUTH_RETURN_MAX_AGE_SECONDS,
  };
}
