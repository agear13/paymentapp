import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { ExtractedParty, ExtractionResult } from './extraction-types';
import type { ReviewFormState, ReviewedParty } from './review-form-types';
import {
  isFixedPayoutAmountComplete,
  isHybridCompensationParty,
  isRevenueSharePctComplete,
} from './compensation-review-validation';
import { traceBuildCompensationProfileFromReview } from './extraction-mapper';

export type CompensationPipelineSnapshot = {
  stage: string;
  participationModel: string | null | undefined;
  fixedAmount: number | null | undefined;
  revenueSharePct: number | null | undefined;
  compensationProfile: {
    compensationType?: string;
    fixedAmount?: number | null;
    percentage?: number | null;
    configured?: boolean;
    configuredAt?: string;
  } | null;
  compensationType: string | null;
  configured: boolean | null;
  /** Mapper / validation hints at this stage */
  hints?: Record<string, unknown>;
};

export function snapCompensationStage(
  stage: string,
  input: {
    participationModel?: string | null;
    fixedAmount?: number | null;
    revenueSharePct?: number | null;
    compensationProfile?: DemoParticipant['compensationProfile'] | null;
    hints?: Record<string, unknown>;
  }
): CompensationPipelineSnapshot {
  const profile = input.compensationProfile;
  return {
    stage,
    participationModel: input.participationModel ?? null,
    fixedAmount: input.fixedAmount ?? null,
    revenueSharePct: input.revenueSharePct ?? null,
    compensationProfile: profile
      ? {
          compensationType: profile.compensationType,
          fixedAmount: profile.fixedAmount ?? null,
          percentage: profile.percentage ?? null,
          configured: profile.configured ?? undefined,
          configuredAt: profile.configuredAt,
        }
      : null,
    compensationType: profile?.compensationType ?? null,
    configured: profile?.configured ?? null,
    hints: input.hints,
  };
}

export function snapFromReviewedParty(
  stage: string,
  party: ReviewedParty,
  hints?: Record<string, unknown>
): CompensationPipelineSnapshot {
  return snapCompensationStage(stage, {
    participationModel: party.participationModel,
    fixedAmount: party.fixedAmount,
    revenueSharePct: party.revenueSharePct,
    compensationProfile: null,
    hints,
  });
}

export function snapFromParticipant(
  stage: string,
  participant: DemoParticipant,
  hints?: Record<string, unknown>
): CompensationPipelineSnapshot {
  return snapCompensationStage(stage, {
    participationModel: participant.participationModel,
    fixedAmount: participant.compensationProfile?.fixedAmount ?? null,
    revenueSharePct:
      participant.compensationProfile?.percentage ??
      (participant.participationModel === 'revenue_share'
        ? participant.commissionValue
        : null),
    compensationProfile: participant.compensationProfile ?? null,
    hints: {
      commissionValue: participant.commissionValue,
      commissionKind: participant.commissionKind,
      ...hints,
    },
  });
}

export function snapFromExtractedParty(stage: string, party: ExtractedParty): CompensationPipelineSnapshot {
  return snapCompensationStage(stage, {
    participationModel: party.participationModel.value,
    fixedAmount: party.fixedAmount.value,
    revenueSharePct: party.revenueSharePct.value,
    compensationProfile: null,
    hints: {
      fixedAmountConfidence: party.fixedAmount.confidence,
      revenueSharePctConfidence: party.revenueSharePct.confidence,
    },
  });
}

export function profileBuildHints(
  party: ReviewedParty,
  original?: ExtractedParty
): Record<string, unknown> {
  return {
    isHybridCompensationParty: isHybridCompensationParty(party, original),
    isFixedPayoutAmountComplete: isFixedPayoutAmountComplete(party),
    isRevenueSharePctComplete: isRevenueSharePctComplete(party),
  };
}

export function snapProfileBuildStage(
  party: ReviewedParty,
  original?: ExtractedParty
): CompensationPipelineSnapshot {
  const profile = traceBuildCompensationProfileFromReview(party, original);
  return snapCompensationStage('3.buildCompensationProfileFromReview', {
    participationModel: party.participationModel,
    fixedAmount: party.fixedAmount,
    revenueSharePct: party.revenueSharePct,
    compensationProfile: profile ?? null,
    hints: profileBuildHints(party, original),
  });
}

export function findFirstCompensationDivergence(
  label: string,
  snapshots: CompensationPipelineSnapshot[],
  expectations: {
    fixedAmount?: number;
    revenueSharePct?: number;
    compensationType?: string;
    configured?: boolean;
    /** Coastal: flag when profile type becomes FIXED_FEE incorrectly */
    rejectCompensationType?: string;
  }
): {
  firstFixedAmountLoss: string | null;
  firstRevenueShareLoss: string | null;
  firstWrongCompensationType: string | null;
  firstConfiguredLoss: string | null;
  details: string[];
} {
  const details: string[] = [];
  let firstFixedAmountLoss: string | null = null;
  let firstRevenueShareLoss: string | null = null;
  let firstWrongCompensationType: string | null = null;
  let firstConfiguredLoss: string | null = null;

  for (const snap of snapshots) {
    if (
      expectations.fixedAmount != null &&
      firstFixedAmountLoss == null &&
      snap.stage !== '0.validatedExtractionResult'
    ) {
      const fa = snap.fixedAmount ?? snap.compensationProfile?.fixedAmount ?? null;
      if (fa !== expectations.fixedAmount) {
        firstFixedAmountLoss = snap.stage;
        details.push(`${label}: fixedAmount 2500 lost at ${snap.stage} (got ${fa})`);
      }
    }
    if (
      expectations.revenueSharePct != null &&
      firstRevenueShareLoss == null &&
      snap.stage !== '0.validatedExtractionResult'
    ) {
      const pct = snap.revenueSharePct ?? snap.compensationProfile?.percentage ?? null;
      if (pct !== expectations.revenueSharePct) {
        firstRevenueShareLoss = snap.stage;
        details.push(`${label}: revenueSharePct 15 lost at ${snap.stage} (got ${pct})`);
      }
    }
    if (
      expectations.rejectCompensationType &&
      firstWrongCompensationType == null &&
      snap.compensationType === expectations.rejectCompensationType
    ) {
      firstWrongCompensationType = snap.stage;
      details.push(
        `${label}: wrong compensationType ${expectations.rejectCompensationType} at ${snap.stage}`
      );
    }
    if (
      expectations.compensationType != null &&
      firstWrongCompensationType == null &&
      snap.compensationType != null &&
      snap.compensationType !== expectations.compensationType
    ) {
      firstWrongCompensationType = snap.stage;
      details.push(
        `${label}: compensationType expected ${expectations.compensationType} got ${snap.compensationType} at ${snap.stage}`
      );
    }
    if (expectations.configured === true && firstConfiguredLoss == null && snap.configured === false) {
      firstConfiguredLoss = snap.stage;
      details.push(`${label}: configured=false at ${snap.stage}`);
    }
  }

  return {
    firstFixedAmountLoss,
    firstRevenueShareLoss,
    firstWrongCompensationType,
    firstConfiguredLoss,
    details,
  };
}

const LOG_PREFIX = '[compensation-pipeline-trace]';

export function logCompensationPipelineTrace(payload: {
  label: string;
  extractionCurrency: ExtractionResult['currency'];
  extractedCurrencyUnsupported: boolean;
  snapshots: CompensationPipelineSnapshot[];
  divergence?: ReturnType<typeof findFirstCompensationDivergence>;
}): void {
  if (typeof console !== 'undefined') {
    console.info(LOG_PREFIX, JSON.stringify(payload, null, 2));
  }
  if (typeof window !== 'undefined') {
    const w = window as Window & { __COMPENSATION_PIPELINE_TRACES__?: unknown[] };
    w.__COMPENSATION_PIPELINE_TRACES__ = [
      ...(w.__COMPENSATION_PIPELINE_TRACES__ ?? []),
      payload,
    ];
  }
}
