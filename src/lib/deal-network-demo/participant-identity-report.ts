import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { normParticipantName } from '@/lib/deal-network-demo/participant-merge';
import { deriveCompensationState } from '@/lib/operations/derivations/derive-compensation-state';

export const DEFAULT_IDENTITY_NAME_PATTERNS = ['island djs', 'coastal promotions'] as const;

export type ParticipantIdentityRow = {
  participantId: string;
  dealId: string;
  dealName: string;
  name: string;
  normalizedName: string;
  createdAt: string;
  compensationProfile: {
    compensationType?: string;
    fixedAmount?: number | null;
    percentage?: number | null;
    configured?: boolean;
    configuredAt?: string;
  } | null;
  commissionValue: number;
  participationModel: DemoParticipant['participationModel'];
  agreementLifecycle: DemoParticipant['agreementLifecycle'];
  participantLifecycle: DemoParticipant['participantLifecycle'];
  /** Label shown in Participants table earnings column (identity/display only). */
  earningsTableLabel: string;
  hasAiImportInNotes: boolean;
  inviteToken: string;
};

export type DuplicateChain = {
  dealId: string;
  dealName: string;
  normalizedName: string;
  participantIds: string[];
  chain: ParticipantIdentityRow[];
  multipleRecords: boolean;
  configuredParticipantIds: string[];
  unconfiguredParticipantIds: string[];
  likelyImportProfileOnId: string | null;
  likelyDisplayedNeedsReviewIds: string[];
  sameIdAsConfiguredProfile: boolean | null;
};

export type ParticipantIdentityReport = {
  queriedAt: string;
  namePatterns: string[];
  projectIdFilter: string | null;
  totalMatches: number;
  participants: ParticipantIdentityRow[];
  byNormalizedName: Record<string, ParticipantIdentityRow[]>;
  duplicateChains: DuplicateChain[];
  answers: {
    A_multipleRecordsPerName: Record<string, boolean>;
    B_profileOnParticipantId: Record<string, string | null>;
    C_needsReviewOrNotConfiguredRowIds: Record<string, string[]>;
    D_sameIdAsProfile: Record<string, boolean | null>;
  };
  saveBranchInference: string[];
};

export function matchesNamePatterns(
  name: string,
  patterns: readonly string[] = DEFAULT_IDENTITY_NAME_PATTERNS
): boolean {
  const n = normParticipantName(name);
  return patterns.some((pat) => n.includes(pat));
}

export function buildParticipantIdentityRow(input: {
  participant: DemoParticipant;
  dealId: string;
  dealName: string;
  createdAt: string;
}): ParticipantIdentityRow {
  const { participant, dealId, dealName, createdAt } = input;
  const profile = participant.compensationProfile;
  const earnings = deriveCompensationState(participant).earningsPrimaryCompact;
  return {
    participantId: participant.id,
    dealId,
    dealName,
    name: participant.name,
    normalizedName: normParticipantName(participant.name),
    createdAt,
    compensationProfile: profile
      ? {
          compensationType: profile.compensationType,
          fixedAmount: profile.fixedAmount ?? null,
          percentage: profile.percentage ?? null,
          configured: profile.configured ?? null,
          configuredAt: profile.configuredAt ?? null,
        }
      : null,
    commissionValue: participant.commissionValue,
    participationModel: participant.participationModel,
    agreementLifecycle: participant.agreementLifecycle,
    participantLifecycle: participant.participantLifecycle,
    earningsTableLabel: earnings,
    hasAiImportInNotes: Boolean(participant.participantNotes?.includes('[AI Import')),
    inviteToken: participant.inviteToken,
  };
}

function isConfiguredProfile(row: ParticipantIdentityRow): boolean {
  return row.compensationProfile?.configured === true;
}

function isNeedsReviewOrNotConfigured(label: string): boolean {
  return label === 'Needs review' || label === 'Not configured';
}

export function buildParticipantIdentityReport(input: {
  rows: ParticipantIdentityRow[];
  namePatterns?: readonly string[];
  projectIdFilter?: string | null;
}): ParticipantIdentityReport {
  const namePatterns = [...(input.namePatterns ?? DEFAULT_IDENTITY_NAME_PATTERNS)];
  const participants = input.rows;
  const byNormalizedName: Record<string, ParticipantIdentityRow[]> = {};

  for (const row of participants) {
    const list = byNormalizedName[row.normalizedName] ?? [];
    list.push(row);
    byNormalizedName[row.normalizedName] = list;
  }

  const duplicateChains: DuplicateChain[] = [];
  const saveBranchInference: string[] = [];

  const A_multipleRecordsPerName: Record<string, boolean> = {};
  const B_profileOnParticipantId: Record<string, string | null> = {};
  const C_needsReviewOrNotConfiguredRowIds: Record<string, string[]> = {};
  const D_sameIdAsProfile: Record<string, boolean | null> = {};

  for (const [norm, list] of Object.entries(byNormalizedName)) {
    const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const configured = sorted.filter(isConfiguredProfile);
    const unconfigured = sorted.filter((r) => !isConfiguredProfile(r));
    const needsReviewIds = sorted
      .filter((r) => isNeedsReviewOrNotConfigured(r.earningsTableLabel))
      .map((r) => r.participantId);

    A_multipleRecordsPerName[norm] = sorted.length > 1;
    B_profileOnParticipantId[norm] =
      configured.length === 1
        ? configured[0]!.participantId
        : configured.length > 1
          ? configured.map((r) => r.participantId).join(',')
          : null;
    C_needsReviewOrNotConfiguredRowIds[norm] = needsReviewIds;

    const profileId = configured.length === 1 ? configured[0]!.participantId : null;
    if (profileId && needsReviewIds.length === 1) {
      D_sameIdAsProfile[norm] = profileId === needsReviewIds[0];
    } else if (profileId && needsReviewIds.length > 1) {
      D_sameIdAsProfile[norm] = needsReviewIds.includes(profileId);
    } else if (profileId && needsReviewIds.length === 0) {
      D_sameIdAsProfile[norm] = true;
    } else {
      D_sameIdAsProfile[norm] = null;
    }

    if (sorted.length > 1) {
      const dealId = sorted[0]!.dealId;
      const dealName = sorted[0]!.dealName;
      const newerWithImport = sorted.filter((r) => r.hasAiImportInNotes);
      const older = sorted[0]!;

      duplicateChains.push({
        dealId,
        dealName,
        normalizedName: norm,
        participantIds: sorted.map((r) => r.participantId),
        chain: sorted,
        multipleRecords: true,
        configuredParticipantIds: configured.map((r) => r.participantId),
        unconfiguredParticipantIds: unconfigured.map((r) => r.participantId),
        likelyImportProfileOnId: configured[0]?.participantId ?? null,
        likelyDisplayedNeedsReviewIds: needsReviewIds,
        sameIdAsConfiguredProfile:
          configured.length === 1 && needsReviewIds.length === 1
            ? configured[0]!.participantId === needsReviewIds[0]
            : null,
      });

      if (configured.length === 1 && unconfigured.length >= 1) {
        const profileOn = configured[0]!;
        const stale = unconfigured.find((r) => r.createdAt < profileOn.createdAt) ?? unconfigured[0];
        if (stale && stale.participantId !== profileOn.participantId) {
          saveBranchInference.push(
            `${norm}: configured profile on newer/different id ${profileOn.participantId} (created ${profileOn.createdAt}); ` +
              `unconfigured/stale row ${stale.participantId} (created ${stale.createdAt}). ` +
              `Strong indicator create-branch added a second row instead of update-branch on ${stale.participantId}.`
          );
        }
      }
      if (newerWithImport.length === 1 && configured.length === 1) {
        const imp = newerWithImport[0]!;
        if (imp.participantId !== configured[0]!.participantId) {
          saveBranchInference.push(
            `${norm}: AI Import notes on ${imp.participantId} but configured profile on ${configured[0]!.participantId}.`
          );
        }
      }
      if (older && !isConfiguredProfile(older) && configured.some((c) => c.createdAt > older.createdAt)) {
        saveBranchInference.push(
          `${norm}: oldest row ${older.participantId} lacks configured profile; later row(s) have profile — update may not have targeted oldest id.`
        );
      }
    }
  }

  return {
    queriedAt: new Date().toISOString(),
    namePatterns,
    projectIdFilter: input.projectIdFilter ?? null,
    totalMatches: participants.length,
    participants,
    byNormalizedName,
    duplicateChains,
    answers: {
      A_multipleRecordsPerName,
      B_profileOnParticipantId,
      C_needsReviewOrNotConfiguredRowIds,
      D_sameIdAsProfile,
    },
    saveBranchInference,
  };
}
