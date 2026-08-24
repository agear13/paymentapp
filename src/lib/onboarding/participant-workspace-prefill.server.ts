import 'server-only';

import { prisma } from '@/lib/server/prisma';
import {
  EMPTY_PARTICIPANT_WORKSPACE_PREFILL,
  extractParticipantOwnedAbnBusinessName,
  parsePrefillSourceParticipantId,
  suggestParticipantWorkspaceName,
  type ParticipantWorkspacePrefill,
} from '@/lib/onboarding/participant-workspace-prefill';

/**
 * Bound-user-only workspace-name personalization.
 * Does not write attribution fields and does not use email or deal-owner identity.
 */
export async function loadAuthorizedParticipantWorkspacePrefill(
  userId: string,
  rawHint: unknown
): Promise<ParticipantWorkspacePrefill> {
  const participantId = parsePrefillSourceParticipantId(rawHint);
  const actorId = userId.trim();
  if (!participantId || !actorId) {
    return EMPTY_PARTICIPANT_WORKSPACE_PREFILL;
  }

  const row = await prisma.deal_network_pilot_participants.findFirst({
    where: {
      id: participantId,
      authenticated_user_id: actorId,
    },
    select: {
      id: true,
      name: true,
      participant_payload: true,
    },
  });
  if (!row) {
    return EMPTY_PARTICIPANT_WORKSPACE_PREFILL;
  }

  const suggestion = suggestParticipantWorkspaceName({
    participantName: row.name,
    abnBusinessName: extractParticipantOwnedAbnBusinessName(row.participant_payload),
  });

  return {
    sourceParticipantId: row.id,
    suggestedWorkspaceName: suggestion.suggestedWorkspaceName,
    suggestedDisplayName: suggestion.suggestedDisplayName,
  };
}
