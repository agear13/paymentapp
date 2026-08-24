import { parseSourceParticipantHint } from '@/lib/participants/source-participant-hint';

export type ParticipantWorkspacePrefill = {
  sourceParticipantId: string | null;
  suggestedWorkspaceName: string | null;
  suggestedDisplayName: string | null;
};

export const EMPTY_PARTICIPANT_WORKSPACE_PREFILL: ParticipantWorkspacePrefill = {
  sourceParticipantId: null,
  suggestedWorkspaceName: null,
  suggestedDisplayName: null,
};

const MAX_WORKSPACE_NAME = 255;

function clipWorkspaceName(value: string): string {
  return value.trim().slice(0, MAX_WORKSPACE_NAME);
}

function asPayloadObject(payload: unknown): Record<string, unknown> | null {
  if (!payload) return null;
  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return null;
}

export function extractParticipantOwnedAbnBusinessName(payload: unknown): string | null {
  const object = asPayloadObject(payload);
  if (!object) return null;
  const supplierOnboarding = object.supplierOnboarding;
  if (!supplierOnboarding || typeof supplierOnboarding !== 'object') return null;
  const abn = (supplierOnboarding as { abn?: { businessName?: unknown } }).abn;
  if (!abn || typeof abn !== 'object') return null;
  const businessName = abn.businessName;
  if (typeof businessName !== 'string') return null;
  const trimmed = businessName.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function suggestParticipantWorkspaceName(input: {
  participantName?: string | null;
  abnBusinessName?: string | null;
}): Pick<ParticipantWorkspacePrefill, 'suggestedWorkspaceName' | 'suggestedDisplayName'> {
  const abnBusinessName = input.abnBusinessName?.trim() ?? '';
  if (abnBusinessName) {
    const name = clipWorkspaceName(abnBusinessName);
    return { suggestedWorkspaceName: name, suggestedDisplayName: name };
  }

  const participantName = input.participantName?.trim() ?? '';
  if (participantName) {
    return {
      suggestedWorkspaceName: clipWorkspaceName(`${participantName}'s workspace`),
      suggestedDisplayName: clipWorkspaceName(participantName),
    };
  }

  return { suggestedWorkspaceName: null, suggestedDisplayName: null };
}

export function parsePrefillSourceParticipantId(value: unknown): string | null {
  const parsed = parseSourceParticipantHint(value);
  return parsed.kind === 'hint' ? parsed.value : null;
}
