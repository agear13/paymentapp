import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { normParticipantName } from '@/lib/deal-network-demo/participant-merge';
import type { ReviewedParty } from './review-form-types';

export type DuplicateResolution = 'update' | 'create';

export interface DuplicateMatch {
  extractedPartyId: string;
  existingParticipant: DemoParticipant;
  matchReason: 'email' | 'name';
}

/**
 * Compare extracted parties against existing project participants.
 * Returns one match per extracted party at most — first email match wins, then name.
 * Only called for Entry Point B (participant_add).
 */
export function detectDuplicates(
  reviewedParties: ReviewedParty[],
  existingParticipants: DemoParticipant[]
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];

  for (const party of reviewedParties) {
    const normName = normParticipantName(party.name);
    const normEmail = party.email.trim().toLowerCase();

    let match: DuplicateMatch | null = null;

    for (const existing of existingParticipants) {
      if (normEmail && existing.email?.trim()) {
        if (normEmail === existing.email.trim().toLowerCase()) {
          match = { extractedPartyId: party.id, existingParticipant: existing, matchReason: 'email' };
          break;
        }
      }
    }

    if (!match) {
      for (const existing of existingParticipants) {
        if (normName && normParticipantName(existing.name) === normName) {
          match = { extractedPartyId: party.id, existingParticipant: existing, matchReason: 'name' };
          break;
        }
      }
    }

    if (match) matches.push(match);
  }

  return matches;
}

/** Build default resolutions map — all matches default to 'update'. */
export function defaultResolutions(
  matches: DuplicateMatch[]
): Record<string, DuplicateResolution> {
  return Object.fromEntries(matches.map((m) => [m.extractedPartyId, 'update']));
}