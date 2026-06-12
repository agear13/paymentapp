import type { ExtractionResult, ExtractedParty, ExtractionConfidence } from './extraction-types';
import {
  buildProjectSummaryOneLiner,
  countPartyObligationMetrics,
} from './party-obligation-metrics';

export interface ExtractionSummaryStats {
  projectCount: number;
  participantCount: number;
  /** Participants with at least one fixed-fee obligation (non-exclusive). */
  fixedFeeObligationCount: number;
  /** Participants with at least one revenue-share obligation (non-exclusive). */
  revenueShareObligationCount: number;
  /** Participants with both fixed-fee and revenue-share obligations. */
  hybridParticipantCount: number;
  attributionCount: number;
  oneLiner: string;
}

const CONFIDENCE_RANK: Record<ExtractionConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
  absent: 0,
};

function lowestConfidence(confidences: ExtractionConfidence[]): ExtractionConfidence {
  return confidences.reduce<ExtractionConfidence>(
    (lowest, c) => (CONFIDENCE_RANK[c] < CONFIDENCE_RANK[lowest] ? c : lowest),
    'high'
  );
}

/** Derive per-party confidence from its critical fields. */
export function derivePartyConfidence(party: ExtractedParty): ExtractionConfidence {
  const critical: ExtractionConfidence[] = [
    party.name.confidence,
    party.participationModel.confidence,
  ];
  if (
    party.participationModel.value === 'fixed_payout' ||
    party.participationModel.value === 'hybrid' ||
    party.fixedAmount.value != null
  ) {
    critical.push(party.fixedAmount.confidence);
  }
  if (
    party.participationModel.value === 'revenue_share' ||
    party.participationModel.value === 'hybrid' ||
    party.revenueSharePct.value != null
  ) {
    critical.push(party.revenueSharePct.confidence);
  }
  return lowestConfidence(critical);
}

/** Build a human-readable summary from an ExtractionResult without an extra AI call. */
export function buildExtractionSummary(result: ExtractionResult): ExtractionSummaryStats {
  const projectCount = result.projectName.value ? 1 : 0;
  const participantCount = result.parties.length;
  const obligationMetrics = countPartyObligationMetrics(result.parties);

  return {
    projectCount,
    participantCount,
    fixedFeeObligationCount: obligationMetrics.fixedFeeObligationCount,
    revenueShareObligationCount: obligationMetrics.revenueShareObligationCount,
    hybridParticipantCount: obligationMetrics.hybridParticipantCount,
    attributionCount: obligationMetrics.attributionCount,
    oneLiner: buildProjectSummaryOneLiner(result),
  };
}
