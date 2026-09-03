/**
 * Participant Portal — server utilities.
 *
 * Workspace URLs identify an invitation. They are not bearer credentials.
 * Authorization is the authenticated Supabase user bound to the invited participant.
 */
import 'server-only';
import { v4 as uuidv4 } from 'uuid';
import type { Prisma } from '@prisma/client';
import { log } from '@/lib/logger';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { prisma } from '@/lib/server/prisma';
import {
  dealRowToRecentDeal,
  getPilotSnapshotForUser,
  participantRowToDemo,
  updatePilotParticipantPayload,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import {
  isAuthorisedParticipantWorkspaceIdentity,
  normalizeParticipantEmail,
} from '@/lib/participant-portal/participant-access';
import { participantWorkspacePath } from '@/lib/participant-portal/participant-portal-url';
import {
  isSafeParticipantReturnPath,
  resolveAuthorizedParticipantDestination,
  type ParticipantAuthDestination,
} from '@/lib/participant-portal/participant-auth-return';
import { deriveParticipantWorkspaceOnboarding } from '@/lib/participant-portal/participant-workspace-onboarding';
import {
  participantWorkspaceChoiceCopy,
  type ParticipantWorkspaceChoice,
} from '@/lib/participant-portal/participant-workspace-choice';

export function createParticipantPortalToken(): string {
  return uuidv4();
}

export async function findParticipantByPortalToken(token: string): Promise<{
  participant: DemoParticipant;
  participantDbId: string;
  dealId: string;
  deal: ReturnType<typeof dealRowToRecentDeal>;
  dealUserId: string;
  authenticatedUserId: string | null;
  participantEmail: string | null;
  convertedOrganizationId: string | null;
  sourceOrganizationId: string | null;
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
    authenticatedUserId: row.authenticated_user_id ?? null,
    participantEmail: row.email?.trim() || participant.email?.trim() || null,
    convertedOrganizationId: row.converted_organization_id ?? null,
    sourceOrganizationId: row.source_organization_id ?? null,
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

/**
 * Restore invitation context after magic-link auth when redirectedFrom was dropped.
 * Unique destination only. Multiple authorised workspaces must go to the chooser.
 */
export async function resolveParticipantAuthDestinationForUser(user: {
  email?: string | null;
  id: string;
}): Promise<ParticipantAuthDestination> {
  try {
    const workspaces = await listAuthorisedParticipantWorkspacesForUser(user);
    return resolveAuthorizedParticipantDestination(workspaces.map((row) => row.path));
  } catch (error) {
    log.warn('participant auth destination lookup failed', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'none' };
  }
}

export async function listAuthorisedParticipantWorkspacesForUser(user: {
  email?: string | null;
  id: string;
}): Promise<ParticipantWorkspaceChoice[]> {
  const email = normalizeParticipantEmail(user.email);
  if (!email && !user.id) return [];

  const rows = await prisma.deal_network_pilot_participants.findMany({
    where: {
      OR: [
        ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
        { authenticated_user_id: user.id },
      ],
    },
    include: { deal: true },
    orderBy: { updated_at: 'desc' },
  });

  const byToken = new Map<string, ParticipantWorkspaceChoice>();
  for (const row of rows) {
    if (!row.deal) continue;
    const participant = participantRowToDemo(row);
    const token = participant.participantPortalToken?.trim();
    if (!token) continue;
    const path = participantWorkspacePath(token);
    if (!isSafeParticipantReturnPath(path)) continue;

    if (
      !isAuthorisedParticipantWorkspaceIdentity({
        user,
        participantEmail: row.email?.trim() || participant.email,
        authenticatedUserId: row.authenticated_user_id,
        dealOwnerUserId: row.deal.user_id,
      })
    ) {
      continue;
    }

    if (byToken.has(token)) continue;

    const deal = dealRowToRecentDeal(row.deal);
    const onboarding = deriveParticipantWorkspaceOnboarding(participant);
    const copy = participantWorkspaceChoiceCopy(onboarding);
    byToken.set(token, {
      portalToken: token,
      path,
      projectName: deal.dealName?.trim() || 'Participant workspace',
      operatorName: deal.partner?.trim() || 'Organiser',
      nextRequiredAction: copy.nextRequiredAction,
      statusLabel: copy.statusLabel,
    });
  }

  return [...byToken.values()];
}
