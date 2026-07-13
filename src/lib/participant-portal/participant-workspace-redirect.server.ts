/**
 * Resolve legacy agreement invite links into the unified Participant Workspace URL.
 */
import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import {
  getParticipantByInviteToken,
  participantRowToDemo,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import { createParticipantPortalToken } from '@/lib/participant-portal/participant-portal.server';
import { participantWorkspacePath } from '@/lib/participant-portal/participant-portal-url';

export async function ensurePortalTokenOnParticipantRow(
  participantId: string
): Promise<string | null> {
  const row = await prisma.deal_network_pilot_participants.findUnique({
    where: { id: participantId },
  });
  if (!row) return null;

  const current = participantRowToDemo(row);
  if (current.participantPortalToken?.trim()) {
    return current.participantPortalToken.trim();
  }

  const token = createParticipantPortalToken();
  const next = { ...current, participantPortalToken: token };
  await prisma.deal_network_pilot_participants.update({
    where: { id: participantId },
    data: {
      participant_payload: next as unknown as Prisma.InputJsonValue,
    },
  });
  return token;
}

/** Map a legacy `/deal-invites/[inviteToken]` URL to `/participant/[workspaceToken]`. */
export async function resolveWorkspacePathFromInviteToken(
  inviteToken: string
): Promise<string | null> {
  const row = await getParticipantByInviteToken(inviteToken);
  if (!row) return null;

  const portalToken = await ensurePortalTokenOnParticipantRow(row.id);
  if (!portalToken) return null;

  return participantWorkspacePath(portalToken);
}
