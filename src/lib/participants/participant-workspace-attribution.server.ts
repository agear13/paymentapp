import 'server-only';

import { prisma } from '@/lib/server/prisma';
import { log } from '@/lib/logger';
import {
  parseSourceParticipantHint,
  readSourceParticipantHint,
  type SourceParticipantHint,
} from '@/lib/participants/source-participant-hint';

export type { SourceParticipantHint };
export { parseSourceParticipantHint, readSourceParticipantHint };

export type ParticipantWorkspaceAttributionResult = {
  attached: boolean;
  participantId: string | null;
};

export function resolveCreateTimeSourceOrganizationId(
  provided: string | null | undefined
): string | null {
  if (typeof provided !== 'string') return null;
  const trimmed = provided.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveSyncCreateSourceOrganizationId(input: {
  participantId: string;
  alreadyPersisted: boolean;
  provenSourceOrganizationId?: string | null;
  stampParticipantIds?: ReadonlySet<string> | null;
}): string | null {
  if (input.alreadyPersisted) return null;
  if (!input.stampParticipantIds?.has(input.participantId)) return null;
  return resolveCreateTimeSourceOrganizationId(input.provenSourceOrganizationId);
}

/**
 * After a genuine organizations insert, attach at most one eligible invitation.
 * Fail closed. Never binds authenticated_user_id. Never writes commission records.
 */
export async function attachParticipantWorkspaceAttribution(input: {
  userId: string;
  newOrganizationId: string;
  hint?: SourceParticipantHint;
}): Promise<ParticipantWorkspaceAttributionResult> {
  const none: ParticipantWorkspaceAttributionResult = { attached: false, participantId: null };
  const userId = input.userId.trim();
  const newOrganizationId = input.newOrganizationId.trim();
  if (!userId || !newOrganizationId) return none;

  const hint = input.hint ?? { kind: 'absent' as const };
  if (hint.kind === 'invalid') return none;

  const membership = await prisma.user_organizations.findUnique({
    where: {
      user_id_organization_id: {
        user_id: userId,
        organization_id: newOrganizationId,
      },
    },
    select: { role: true },
  });
  if (!membership || membership.role.toUpperCase() !== 'OWNER') {
    return none;
  }

  const newOrg = await prisma.organizations.findUnique({
    where: { id: newOrganizationId },
    select: { id: true },
  });
  if (!newOrg) return none;

  const rows = await prisma.deal_network_pilot_participants.findMany({
    where: {
      authenticated_user_id: userId,
      converted_organization_id: null,
      source_organization_id: { not: null },
      NOT: { source_organization_id: newOrganizationId },
    },
    select: {
      id: true,
      source_organization_id: true,
      deal_id: true,
      deal: { select: { id: true } },
      source_organization: { select: { id: true } },
    },
  });

  const eligible = rows.filter(
    (row) =>
      Boolean(row.deal?.id) &&
      Boolean(row.source_organization?.id) &&
      row.source_organization_id != null &&
      row.source_organization_id !== newOrganizationId
  );

  let selected = eligible;
  if (hint.kind === 'hint') {
    selected = eligible.filter((row) => row.id === hint.value);
  } else if (eligible.length !== 1) {
    return none;
  }

  if (selected.length !== 1) return none;
  const candidate = selected[0];

  try {
    const updated = await prisma.deal_network_pilot_participants.updateMany({
      where: {
        id: candidate.id,
        authenticated_user_id: userId,
        converted_organization_id: null,
        source_organization_id: { not: null },
        NOT: { source_organization_id: newOrganizationId },
      },
      data: {
        converted_organization_id: newOrganizationId,
        converted_at: new Date(),
      },
    });
    if (updated.count !== 1) return none;
    return { attached: true, participantId: candidate.id };
  } catch (error) {
    log.warn('participant workspace attribution attach failed', {
      userId,
      newOrganizationId,
      participantId: candidate.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return none;
  }
}
