import type { ReleaseBatchEligibility } from '@/lib/operations/selectors/derive-release-batch-eligibility';
import type { PilotReleaseBatchLine } from '@/lib/operations/orchestration/pilot-release-batch.server';

export type ScopeReleaseBatchResult =
  | { ok: true; scopedEligibility: ReleaseBatchEligibility; participantIds: string[] }
  | { ok: false; error: string; message: string };

/** Normalize optional participant id filter; empty/omitted means full batch. */
export function normalizeReleaseParticipantIds(
  participantIds?: string[] | null
): string[] | undefined {
  if (!participantIds?.length) return undefined;
  const ids = [...new Set(participantIds.map((id) => id.trim()).filter(Boolean))];
  return ids.length > 0 ? ids : undefined;
}

export function filterReleaseBatchEligibility(
  eligibility: ReleaseBatchEligibility,
  participantIds: string[]
): ReleaseBatchEligibility {
  const allowed = new Set(participantIds);
  const eligibleParticipants = eligibility.eligibleParticipants.filter((p) =>
    allowed.has(p.participantId)
  );
  const lineCount = eligibleParticipants.reduce((n, p) => n + p.obligationCount, 0);
  const total = eligibleParticipants.reduce((sum, p) => sum + p.amount, 0);
  return {
    eligibleParticipants,
    lineCount,
    participantCount: eligibleParticipants.length,
    total,
    currency: eligibility.currency,
  };
}

export function filterPilotReleaseBatchLines(
  lines: PilotReleaseBatchLine[],
  participantIds?: string[]
): PilotReleaseBatchLine[] {
  if (!participantIds?.length) return lines;
  const allowed = new Set(participantIds);
  return lines.filter((line) => allowed.has(line.participantId));
}

/**
 * Validates requested participant ids against canonical eligibility.
 * Used for single-participant and future multi-id releases (launch: single id only in UI).
 */
export function scopeReleaseBatchToParticipants(
  eligibility: ReleaseBatchEligibility,
  participantIds?: string[] | null
): ScopeReleaseBatchResult {
  const normalized = normalizeReleaseParticipantIds(participantIds);
  if (!normalized) {
    return { ok: true, scopedEligibility: eligibility, participantIds: [] };
  }

  const eligibleIds = new Set(
    eligibility.eligibleParticipants.map((p) => p.participantId)
  );
  const notEligible = normalized.filter((id) => !eligibleIds.has(id));
  if (notEligible.length > 0) {
    return {
      ok: false,
      error: 'Participant not release-eligible',
      message: `Participant(s) not release-eligible for ${eligibility.currency}: ${notEligible.join(', ')}. Resolve blockers before releasing.`,
    };
  }

  const scopedEligibility = filterReleaseBatchEligibility(eligibility, normalized);
  if (scopedEligibility.participantCount === 0) {
    return {
      ok: false,
      error: 'No release-eligible participants',
      message: `No participants pass release eligibility for ${eligibility.currency} in the requested set.`,
    };
  }

  return { ok: true, scopedEligibility, participantIds: normalized };
}
