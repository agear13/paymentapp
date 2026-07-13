/** Client-safe URL helpers for the Participant Workspace (single participant-facing destination). */

export type ParticipantWorkspaceStep = 'payout';

export function participantWorkspacePath(
  token: string,
  step?: ParticipantWorkspaceStep
): string {
  const base = `/participant/${encodeURIComponent(token)}`;
  if (step === 'payout') return `${base}?step=payout`;
  return base;
}

export function buildParticipantWorkspaceUrl(
  token: string,
  origin?: string,
  step?: ParticipantWorkspaceStep
): string {
  const base =
    origin ??
    (typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL ?? '');
  return `${base}${participantWorkspacePath(token, step)}`;
}

export function buildParticipantWorkspacePayoutUrl(token: string, origin?: string): string {
  return buildParticipantWorkspaceUrl(token, origin, 'payout');
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
