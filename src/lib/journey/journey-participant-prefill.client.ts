'use client';

import { readStoredSourceParticipantHint } from '@/lib/journey/journey-source-participant.client';
import type { ParticipantWorkspacePrefill } from '@/lib/onboarding/participant-workspace-prefill';
import { EMPTY_PARTICIPANT_WORKSPACE_PREFILL } from '@/lib/onboarding/participant-workspace-prefill';

export async function fetchAuthorizedParticipantWorkspacePrefill(): Promise<ParticipantWorkspacePrefill> {
  const hint = readStoredSourceParticipantHint();
  if (!hint) return EMPTY_PARTICIPANT_WORKSPACE_PREFILL;

  try {
    const response = await fetch(
      `/api/onboarding/participant-prefill?sourceParticipantId=${encodeURIComponent(hint)}`,
      { credentials: 'include', cache: 'no-store' }
    );
    if (!response.ok) return EMPTY_PARTICIPANT_WORKSPACE_PREFILL;
    const data = (await response.json()) as ParticipantWorkspacePrefill;
    return {
      sourceParticipantId:
        typeof data.sourceParticipantId === 'string' ? data.sourceParticipantId : null,
      suggestedWorkspaceName:
        typeof data.suggestedWorkspaceName === 'string' ? data.suggestedWorkspaceName : null,
      suggestedDisplayName:
        typeof data.suggestedDisplayName === 'string' ? data.suggestedDisplayName : null,
    };
  } catch {
    return EMPTY_PARTICIPANT_WORKSPACE_PREFILL;
  }
}

export function usableSuggestedWorkspaceName(
  prefill: ParticipantWorkspacePrefill | null | undefined
): string | null {
  const value = prefill?.suggestedWorkspaceName?.trim() ?? '';
  if (value.length < 2 || value.length > 255) return null;
  return value;
}

export function shouldOfferParticipantWorkspaceNameConfirm(
  hasOrganization: boolean,
  prefill: ParticipantWorkspacePrefill | null | undefined
): boolean {
  if (hasOrganization) return false;
  return usableSuggestedWorkspaceName(prefill) !== null;
}
