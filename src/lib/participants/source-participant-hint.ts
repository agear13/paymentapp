/**
 * Non-authoritative journey context for participant → workspace conversion.
 * Shared by client persistence and the Phase 2 server hint reader.
 * This is never attribution truth.
 */

export type SourceParticipantHint =
  | { kind: 'absent' }
  | { kind: 'invalid' }
  | { kind: 'hint'; value: string };

export const SOURCE_PARTICIPANT_HINT_MAX_LENGTH = 255;

export function parseSourceParticipantHint(value: unknown): SourceParticipantHint {
  if (value == null) return { kind: 'absent' };
  if (typeof value !== 'string') return { kind: 'invalid' };
  const trimmed = value.trim();
  if (!trimmed) return { kind: 'absent' };
  if (trimmed.length > SOURCE_PARTICIPANT_HINT_MAX_LENGTH || trimmed.includes('\0')) {
    return { kind: 'invalid' };
  }
  return { kind: 'hint', value: trimmed };
}

export function readSourceParticipantHint(input: {
  body?: { participantId?: unknown; sourceParticipantId?: unknown } | null;
  searchParams?: URLSearchParams | null;
}): SourceParticipantHint {
  const fromBody = parseSourceParticipantHint(
    input.body?.sourceParticipantId ?? input.body?.participantId
  );
  if (fromBody.kind !== 'absent') return fromBody;

  const fromQuery = parseSourceParticipantHint(
    input.searchParams?.get('sourceParticipantId') ?? input.searchParams?.get('participantId')
  );
  return fromQuery;
}

export function participantWorkspaceConversionHref(participantId: string): string {
  const parsed = parseSourceParticipantHint(participantId);
  if (parsed.kind !== 'hint') return '/journey/provisioning';
  return `/journey/provisioning?sourceParticipantId=${encodeURIComponent(parsed.value)}`;
}

export function shouldShowParticipantWorkspaceConversionCta(input: {
  onboardingComplete: boolean;
  previewMode: boolean;
  sourceParticipantId?: string | null;
}): boolean {
  if (input.previewMode || !input.onboardingComplete) return false;
  return parseSourceParticipantHint(input.sourceParticipantId).kind === 'hint';
}
