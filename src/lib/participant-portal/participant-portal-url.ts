/** Client-safe URL helpers for the Participant Workspace (single participant-facing destination). */

import { resolveCanonicalPublicOrigin, resolveParticipantLinkOrigin } from '@/lib/runtime/customer-facing-url';

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
  const base = resolveParticipantLinkOrigin(origin);
  return `${base}${participantWorkspacePath(token, step)}`;
}

export function buildParticipantWorkspacePayoutUrl(token: string, origin?: string): string {
  return buildParticipantWorkspaceUrl(token, origin, 'payout');
}

/** Canonical `{public-origin}/participant/{token}` from the incoming request. */
export function buildCanonicalParticipantWorkspaceUrl(
  token: string,
  request: {
    nextUrl: { origin: string; protocol: string };
    headers: { get(name: string): string | null };
  },
  step?: ParticipantWorkspaceStep
): string {
  return buildParticipantWorkspaceUrl(token, resolveCanonicalPublicOrigin(request), step);
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
