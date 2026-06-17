import type { ExtractionResult, ExtractedParty, ExtractionConfidence, ServiceCategory } from './extraction-types';
import {
  buildProjectSummaryOneLiner,
  countPartyObligationMetrics,
  hasFixedFeeAmount,
  hasRevenueSharePct,
} from './party-obligation-metrics';
import { inferServiceCategoriesForParties } from './service-category-detection';

export interface ExtractionSummaryStats {
  projectCount: number;
  participantCount: number;
  fixedFeeObligationCount: number;
  revenueShareObligationCount: number;
  hybridParticipantCount: number;
  attributionCount: number;
  serviceCategories: ServiceCategory[];
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

function isUnclearConfidence(confidence: ExtractionConfidence): boolean {
  return confidence === 'absent' || confidence === 'low';
}

/**
 * Participant confidence reflects identity and core compensation clarity only.
 * Conditional bonuses, milestones, hybrid structures, and deliverables do not reduce confidence.
 */
export function derivePartyConfidence(party: ExtractedParty): ExtractionConfidence {
  const nameConf = party.name.confidence;
  if (isUnclearConfidence(nameConf)) return nameConf;

  const hasFixed = hasFixedFeeAmount(party);
  const hasRevenue = hasRevenueSharePct(party);
  const critical: ExtractionConfidence[] = [nameConf];

  if (hasFixed) {
    critical.push(party.fixedAmount.confidence);
  } else if (party.participationModel.value === 'fixed_payout') {
    critical.push(party.fixedAmount.confidence);
  }

  if (hasRevenue) {
    critical.push(party.revenueSharePct.confidence);
  } else if (
    party.participationModel.value === 'revenue_share' ||
    party.participationModel.value === 'hybrid'
  ) {
    critical.push(party.revenueSharePct.confidence);
  }

  if (!hasFixed && !hasRevenue && party.participationModel.value === 'customer_attribution') {
    critical.push(party.participationModel.confidence);
  }

  if (critical.length === 1) {
    return nameConf;
  }

  return lowestConfidence(critical);
}

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
    serviceCategories: inferServiceCategoriesForParties(result.parties),
    oneLiner: buildProjectSummaryOneLiner(result),
  };
}
