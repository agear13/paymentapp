import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { normParticipantName } from '@/lib/deal-network-demo/participant-merge';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DuplicateMatch } from '@/lib/ai-extractor/duplicate-detection';
import {
  mapSinglePartyToParticipant,
  mergeExtractedCompensationIntoExistingParticipant,
} from '@/lib/ai-extractor/extraction-mapper';
import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import type { ReviewFormState } from '@/lib/ai-extractor/review-form-types';

export type DuplicateSaveBranch = 'update' | 'create';

export type PartySaveBranchTrace = {
  partyId: string;
  partyName: string;
  normalizedName: string;
  duplicateMatchesForParty: Array<{
    extractedPartyId: string;
    matchReason: 'email' | 'name';
    existingParticipantId: string;
    existingParticipantName: string;
    existingDealId: string | undefined;
  }>;
  duplicateResolutionsBeforeSave: Record<string, DuplicateSaveBranch>;
  resolutionRaw: DuplicateSaveBranch | undefined;
  resolutionComputed: DuplicateSaveBranch;
  enteredBranch: DuplicateSaveBranch;
  matchFound: boolean;
  existingParticipantIdUpdated: string | null;
  builtParticipantId: string;
};

export type DuplicateSavePathReport = {
  label: string;
  dealId: string;
  duplicateMatchesAtSave: Array<{
    extractedPartyId: string;
    matchReason: 'email' | 'name';
    existingParticipantId: string;
    existingParticipantName: string;
  }>;
  partyTraces: PartySaveBranchTrace[];
  participantCountBeforeSave: number;
  participantCountAfterSave: number;
  participantCountOnDealBefore: number;
  participantCountOnDealAfter: number;
  sameNameCountBefore: Record<string, number>;
  sameNameCountAfter: Record<string, number>;
  snapshotDiff: {
    existingParticipantUpdated: Array<{
      participantId: string;
      name: string;
      changed: boolean;
    }>;
    newParticipantsCreated: Array<{ participantId: string; name: string }>;
    duplicateNameRowsAfter: Array<{ normalizedName: string; participantIds: string[] }>;
  };
};

function participantsOnDeal(participants: DemoParticipant[], dealId: string): DemoParticipant[] {
  return participants.filter((p) => p.dealId === dealId);
}

function countByNormalizedName(
  participants: DemoParticipant[],
  names: string[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const name of names) {
    const n = normParticipantName(name);
    out[n] = participants.filter((p) => normParticipantName(p.name) === n).length;
  }
  return out;
}

function participantCompFingerprint(p: DemoParticipant): string {
  const profile = p.compensationProfile;
  return JSON.stringify({
    participationModel: p.participationModel,
    commissionValue: p.commissionValue,
    compensationType: profile?.compensationType ?? null,
    fixedAmount: profile?.fixedAmount ?? null,
    percentage: profile?.percentage ?? null,
    configured: profile?.configured ?? null,
  });
}

export function runParticipantAddSaveBranchTrace(input: {
  label: string;
  form: ReviewFormState;
  result: ExtractionResult;
  existingDeal: RecentDeal;
  /** Same source as ExtractionReviewModal duplicateMatches useMemo (project-scoped). */
  duplicateMatchesAtSave: DuplicateMatch[];
  snapshotParticipants: DemoParticipant[];
  provenanceTag: string;
}): { report: DuplicateSavePathReport; updatedParticipants: DemoParticipant[] } {
  const { label, form, result, existingDeal, duplicateMatchesAtSave, snapshotParticipants, provenanceTag } =
    input;

  const dealId = existingDeal.id;
  const beforeAll = [...snapshotParticipants];
  const beforeOnDeal = participantsOnDeal(beforeAll, dealId);
  const partyNames = form.parties.filter((p) => p.name.trim()).map((p) => p.name);

  const originalsById = new Map(result.parties.map((p) => [p.id, p]));
  let updatedParticipants = [...beforeAll];
  const partyTraces: PartySaveBranchTrace[] = [];
  const existingUpdatedIds = new Set<string>();
  const newCreated: Array<{ participantId: string; name: string }> = [];

  for (const party of form.parties.filter((p) => p.name.trim().length > 0)) {
    const resolutionRaw = form.duplicateResolutions[party.id];
    const resolutionComputed = resolutionRaw ?? 'create';
    const match = duplicateMatchesAtSave.find((m) => m.extractedPartyId === party.id);
    const built = mapSinglePartyToParticipant(
      party,
      existingDeal,
      provenanceTag,
      originalsById.get(party.id)
    );

    const partyMatches = duplicateMatchesAtSave
      .filter((m) => m.extractedPartyId === party.id)
      .map((m) => ({
        extractedPartyId: m.extractedPartyId,
        matchReason: m.matchReason,
        existingParticipantId: m.existingParticipant.id,
        existingParticipantName: m.existingParticipant.name,
        existingDealId: m.existingParticipant.dealId,
      }));

    let enteredBranch: DuplicateSaveBranch;
    let existingParticipantIdUpdated: string | null = null;

    if (resolutionComputed === 'update' && match) {
      enteredBranch = 'update';
      existingParticipantIdUpdated = match.existingParticipant.id;
      existingUpdatedIds.add(match.existingParticipant.id);
      updatedParticipants = updatedParticipants.map((ep) =>
        ep.id === match.existingParticipant.id
          ? mergeExtractedCompensationIntoExistingParticipant(ep, built)
          : ep
      );
    } else {
      enteredBranch = 'create';
      updatedParticipants.push(built);
      newCreated.push({ participantId: built.id, name: built.name });
    }

    partyTraces.push({
      partyId: party.id,
      partyName: party.name,
      normalizedName: normParticipantName(party.name),
      duplicateMatchesForParty: partyMatches,
      duplicateResolutionsBeforeSave: { ...form.duplicateResolutions },
      resolutionRaw,
      resolutionComputed,
      enteredBranch,
      matchFound: match != null,
      existingParticipantIdUpdated,
      builtParticipantId: built.id,
    });
  }

  const afterAll = updatedParticipants;
  const afterOnDeal = participantsOnDeal(afterAll, dealId);

  const existingParticipantUpdated = [...existingUpdatedIds].map((id) => {
    const before = beforeAll.find((p) => p.id === id);
    const after = afterAll.find((p) => p.id === id);
    return {
      participantId: id,
      name: after?.name ?? before?.name ?? '',
      changed:
        before != null && after != null
          ? participantCompFingerprint(before) !== participantCompFingerprint(after)
          : false,
    };
  });

  const duplicateNameRowsAfter: Array<{ normalizedName: string; participantIds: string[] }> = [];
  const seenNorm = new Set<string>();
  for (const p of afterOnDeal) {
    const n = normParticipantName(p.name);
    if (seenNorm.has(n)) continue;
    seenNorm.add(n);
    const ids = afterOnDeal.filter((x) => normParticipantName(x.name) === n).map((x) => x.id);
    if (ids.length > 1) duplicateNameRowsAfter.push({ normalizedName: n, participantIds: ids });
  }

  const report: DuplicateSavePathReport = {
    label,
    dealId,
    duplicateMatchesAtSave: duplicateMatchesAtSave.map((m) => ({
      extractedPartyId: m.extractedPartyId,
      matchReason: m.matchReason,
      existingParticipantId: m.existingParticipant.id,
      existingParticipantName: m.existingParticipant.name,
    })),
    partyTraces,
    participantCountBeforeSave: beforeAll.length,
    participantCountAfterSave: afterAll.length,
    participantCountOnDealBefore: beforeOnDeal.length,
    participantCountOnDealAfter: afterOnDeal.length,
    sameNameCountBefore: countByNormalizedName(beforeOnDeal, partyNames),
    sameNameCountAfter: countByNormalizedName(afterOnDeal, partyNames),
    snapshotDiff: {
      existingParticipantUpdated,
      newParticipantsCreated: newCreated,
      duplicateNameRowsAfter,
    },
  };

  return { report, updatedParticipants: afterAll };
}

const LOG_PREFIX = '[duplicate-save-path]';

declare global {
  interface Window {
    /** Append-only session log for duplicate-save-path investigation (DevTools: copy after import). */
    __DUPLICATE_SAVE_PATH_REPORTS__?: DuplicateSavePathReport[];
  }
}

export function logDuplicateSavePathReport(report: DuplicateSavePathReport): void {
  if (typeof console !== 'undefined') {
    console.info(LOG_PREFIX, JSON.stringify(report, null, 2));
  }
  if (typeof window !== 'undefined') {
    window.__DUPLICATE_SAVE_PATH_REPORTS__ = [
      ...(window.__DUPLICATE_SAVE_PATH_REPORTS__ ?? []),
      report,
    ];
  }
}
