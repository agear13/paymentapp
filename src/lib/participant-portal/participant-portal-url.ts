/** Client-safe URL helpers for the Participant Workspace (single participant-facing destination). */

export function participantWorkspacePath(token: string): string {
  return `/participant/${encodeURIComponent(token)}`;
}

export function buildParticipantWorkspaceUrl(token: string, origin?: string): string {
  const base =
    origin ??
    (typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL ?? '');
  return `${base}${participantWorkspacePath(token)}`;
}

/** @deprecated Use participantWorkspacePath */
export const participantPortalPath = participantWorkspacePath;

/** @deprecated Use buildParticipantWorkspaceUrl */
export const buildParticipantPortalUrl = buildParticipantWorkspaceUrl;

export function resolveParticipantWorkspaceToken(
  participant: { participantPortalToken?: string | null }
): string | null {
  return participant.participantPortalToken?.trim() || null;
}

export function buildParticipantWorkspaceUrlForParticipant(
  participant: { participantPortalToken?: string | null },
  origin?: string
): string | null {
  const token = resolveParticipantWorkspaceToken(participant);
  if (!token) return null;
  return buildParticipantWorkspaceUrl(token, origin);
}
