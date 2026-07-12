/** Client-safe URL helpers for the participant portal (no server imports). */

export function participantPortalPath(token: string): string {
  return `/participant/${encodeURIComponent(token)}`;
}

export function buildParticipantPortalUrl(token: string, origin?: string): string {
  const base =
    origin ??
    (typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL ?? '');
  return `${base}${participantPortalPath(token)}`;
}
