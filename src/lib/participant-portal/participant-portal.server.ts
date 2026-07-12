/**
 * Participant Portal — server utilities.
 *
 * Token-based authentication for the public participant commercial workspace.
 * Tokens live in participant_payload.participantPortalToken (no extra DB column).
 */
import 'server-only';
import { v4 as uuidv4 } from 'uuid';
import type { Prisma } from '@prisma/client';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { prisma } from '@/lib/server/prisma';
import {
  dealRowToRecentDeal,
  getPilotSnapshotForUser,
  participantRowToDemo,
  updatePilotParticipantPayload,
} from '@/lib/deal-network-demo/pilot-snapshot.server';

export function createParticipantPortalToken(): string {
  return uuidv4();
}

export async function findParticipantByPortalToken(token: string): Promise<{
  participant: DemoParticipant;
  participantDbId: string;
  dealId: string;
  deal: ReturnType<typeof dealRowToRecentDeal>;
  dealUserId: string;
} | null> {
  const rows = await prisma.deal_network_pilot_participants.findMany({
    where: {
      participant_payload: {
        path: ['participantPortalToken'],
        equals: token,
      },
    },
    include: { deal: true },
    take: 1,
  });

  const row = rows[0];
  if (!row?.deal) return null;

  const participant = participantRowToDemo(row);
  return {
    participant,
    participantDbId: row.id,
    dealId: row.deal_id,
    deal: dealRowToRecentDeal(row.deal),
    dealUserId: row.deal.user_id,
  };
}

export async function ensureParticipantPortalToken(
  participantId: string,
  userId: string
): Promise<{ participant: DemoParticipant; token: string; created: boolean }> {
  const snapshot = await getPilotSnapshotForUser(userId);
  const row = await prisma.deal_network_pilot_participants.findUnique({
    where: { id: participantId },
    include: { deal: true },
  });

  if (!row?.deal) {
    throw new Error('PARTICIPANT_NOT_FOUND');
  }

  const dealOwned = snapshot.deals.some((d) => d.id === row.deal_id);
  if (!dealOwned) {
    throw new Error('FORBIDDEN');
  }

  const current = participantRowToDemo(row);
  if (current.participantPortalToken?.trim()) {
    return {
      participant: current,
      token: current.participantPortalToken.trim(),
      created: false,
    };
  }

  const token = createParticipantPortalToken();
  const persisted = await updatePilotParticipantPayload(participantId, userId, {
    participantPortalToken: token,
  });
  const participant = persisted ?? { ...current, participantPortalToken: token };

  return { participant, token, created: true };
}

export async function regenerateParticipantPortalToken(
  participantId: string,
  userId: string
): Promise<{ participant: DemoParticipant; token: string }> {
  const snapshot = await getPilotSnapshotForUser(userId);
  const row = await prisma.deal_network_pilot_participants.findUnique({
    where: { id: participantId },
    include: { deal: true },
  });

  if (!row?.deal) {
    throw new Error('PARTICIPANT_NOT_FOUND');
  }

  const dealOwned = snapshot.deals.some((d) => d.id === row.deal_id);
  if (!dealOwned) {
    throw new Error('FORBIDDEN');
  }

  const current = participantRowToDemo(row);
  const token = createParticipantPortalToken();
  const persisted = await updatePilotParticipantPayload(participantId, userId, {
    participantPortalToken: token,
  });
  const participant = persisted ?? { ...current, participantPortalToken: token };

  return { participant, token };
}

export async function markParticipantPortalOpened(token: string): Promise<void> {
  const found = await findParticipantByPortalToken(token);
  if (!found) return;

  const cur = found.participant;
  const next: DemoParticipant = {
    ...cur,
    portalOpenedAt: cur.portalOpenedAt ?? new Date().toISOString(),
    portalLastOpenedAt: new Date().toISOString(),
  };

  await prisma.deal_network_pilot_participants.update({
    where: { id: found.participantDbId },
    data: {
      participant_payload: next as unknown as Prisma.InputJsonValue,
    },
  });
}
