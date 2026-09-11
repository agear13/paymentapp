import type {
  DecisionConfidenceLevel,
  DecisionPriority,
  RouteDecision,
  RouteDecisionAssessment,
  ShadowDecisionComparison,
} from '@/lib/route-intelligence/decision-types';
import type { SettlementBand, TotalCostResult } from '@/lib/route-intelligence/types';

export const RECOMMENDATION_REASON_KINDS = [
  'capability_supported',
  'operationally_clear',
  'regulatory_clear',
  'lower_evidenced_cost',
  'faster_evidenced_settlement',
  'better_evidenced_fx',
  'route_available',
  'stronger_evidence',
  'objective_alignment',
] as const;

export type RecommendationReasonKind = (typeof RECOMMENDATION_REASON_KINDS)[number];

export type RecommendationExplanationStatus = 'explained' | 'disagreement' | 'insufficient';

export type RecommendationReason = {
  kind: RecommendationReasonKind;
  text: string;
};

export type RecommendationNote = {
  kind: string;
  text: string;
};

export type RecommendationEvidenceRef = {
  label: string;
  host: string;
};

export type RecommendationConfidence = {
  level: DecisionConfidenceLevel;
  label: 'High' | 'Moderate' | 'Low' | 'Unknown';
};

export type RecommendationExplanation = {
  status: RecommendationExplanationStatus;
  displayedOfferingId: string;
  displayedProviderName: string;
  objective: DecisionPriority;
  objectiveLabel: string;
  confidence: RecommendationConfidence | null;
  reasons: RecommendationReason[];
  tradeoffs: RecommendationNote[];
  unknowns: RecommendationNote[];
  evidence: RecommendationEvidenceRef[];
  summary: string;
};

export type RecommendationExplanationContext = {
  displayedOfferingId: string;
  displayedProviderName: string;
  comparison: ShadowDecisionComparison;
  offeringNames?: Readonly<Record<string, string>>;
};

const CUSTOMER_SAFE_EVIDENCE_HOSTS = new Set(['status.wise.com', 'www.ecb.europa.eu', 'www.rba.gov.au']);

const SETTLEMENT_RANK: Record<SettlementBand, number> = {
  instant: 0,
  minutes: 1,
  same_day: 2,
  next_business_day: 3,
  multi_day: 4,
  unknown: 5,
};

const DISAGREEMENT_SUMMARY =
  'Provvy is still comparing the available routes. Some route information is currently incomplete.';
const INSUFFICIENT_SUMMARY = 'Provvy is still gathering route evidence for this payment.';

const OBJECTIVE_LABEL: Record<DecisionPriority, string> = {
  lowest_cost: 'Lowest total cost',
  fastest: 'Fastest',
  simplest: 'Simplest',
};

export function confidenceDisplayLabel(level: DecisionConfidenceLevel): RecommendationConfidence['label'] {
  if (level === 'high') return 'High';
  if (level === 'moderate') return 'Moderate';
  if (level === 'low') return 'Low';
  return 'Unknown';
}

function knownCost(result: TotalCostResult): result is Extract<TotalCostResult, { state: 'known' }> {
  return result.state === 'known';
}

function cheaperThan(left: RouteDecisionAssessment, right: RouteDecisionAssessment): boolean {
  if (!knownCost(left.totalCost) || !knownCost(right.totalCost)) return false;
  if (left.totalCost.destinationAmount !== right.totalCost.destinationAmount) {
    return left.totalCost.destinationAmount > right.totalCost.destinationAmount;
  }
  return left.totalCost.explicitFeeAmount < right.totalCost.explicitFeeAmount;
}

function settlementRank(assessment: RouteDecisionAssessment): number {
  const band = assessment.economic.settlement.observation?.value.band;
  if (assessment.economic.settlement.state !== 'known' || !band) return SETTLEMENT_RANK.unknown;
  return SETTLEMENT_RANK[band];
}

function knownFactorCount(assessment: RouteDecisionAssessment): number {
  return assessment.factors.filter((factor) => factor.state === 'known').length;
}

function evidenceHost(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    return CUSTOMER_SAFE_EVIDENCE_HOSTS.has(host) ? host : null;
  } catch {
    return null;
  }
}

function evidenceLabel(host: string): string {
  if (host === 'status.wise.com') return 'Wise Statuspage';
  if (host === 'www.ecb.europa.eu') return 'ECB euro reference rates';
  if (host === 'www.rba.gov.au') return 'Reserve Bank of Australia';
  return host;
}

function regulatoryIsClear(assessment: RouteDecisionAssessment): boolean {
  const permitted = assessment.regulatory.filter(
    (item) =>
      Boolean(item.sourceUrl) &&
      item.freshness === 'fresh' &&
      item.status === 'not_affected' &&
      (item.reason === 'rail_match' || item.regulatoryStatus === 'permitted')
  );
  if (permitted.length === 0) return false;
  return !assessment.regulatory.some((item) => item.status === 'affected' || item.status === 'unknown');
}

function fxIsSourced(assessment: RouteDecisionAssessment): boolean {
  const fx = assessment.economic.fx;
  const kind = fx.observation?.value.rateKind;
  return (
    fx.state === 'known' &&
    Boolean(kind) &&
    kind !== 'indicative' &&
    fx.provenance === 'externally_sourced'
  );
}

function collectReasons(recommended: RouteDecisionAssessment, alternatives: RouteDecisionAssessment[]): RecommendationReason[] {
  const reasons: RecommendationReason[] = [];
  const comparable = alternatives.filter((item) => item.recommendable);

  if (recommended.positives.includes('corridor_capability_supported')) {
    reasons.push({
      kind: 'capability_supported',
      text: "This corridor is supported in Provvy's capability evidence.",
    });
  }

  if (recommended.positives.includes('fresh_operational_not_affected')) {
    reasons.push({
      kind: 'operationally_clear',
      text: 'Current operational status is clear.',
    });
  }

  if (regulatoryIsClear(recommended)) {
    reasons.push({
      kind: 'regulatory_clear',
      text: 'No sourced regulatory restriction currently applies to this route.',
    });
  }

  if (recommended.positives.includes('known_total_economic_outcome')) {
    const othersWithCost = comparable.filter((item) => knownCost(item.totalCost));
    if (othersWithCost.length > 0 && othersWithCost.every((item) => cheaperThan(recommended, item))) {
      reasons.push({
        kind: 'lower_evidenced_cost',
        text: 'Sourced fee and FX evidence currently support a lower total-cost outcome than the other evidenced routes.',
      });
    } else if (recommended.route.currencyPair.source && recommended.economic.fee.state === 'known') {
      reasons.push({
        kind: 'objective_alignment',
        text: 'Provvy has a computed total-cost outcome from sourced fee and FX evidence.',
      });
    }
  }

  if (fxIsSourced(recommended) && !reasons.some((item) => item.kind === 'lower_evidenced_cost' || item.kind === 'objective_alignment')) {
    reasons.push({
      kind: 'better_evidenced_fx',
      text: 'Provvy has sourced FX evidence for this currency pair.',
    });
  }

  const othersWithSettlement = comparable.filter((item) => item.economic.settlement.state === 'known');
  if (recommended.economic.settlement.state === 'known' && othersWithSettlement.length > 0) {
    const recommendedRank = settlementRank(recommended);
    if (othersWithSettlement.every((item) => recommendedRank < settlementRank(item))) {
      reasons.push({
        kind: 'faster_evidenced_settlement',
        text: 'Sourced settlement evidence is faster than the other evidenced routes.',
      });
    }
  }

  if (recommended.positives.includes('route_available')) {
    reasons.push({
      kind: 'route_available',
      text: 'Sourced route-availability evidence currently shows this route as available.',
    });
  }

  const recommendedKnown = knownFactorCount(recommended);
  if (
    comparable.length > 0 &&
    comparable.every((item) => recommendedKnown > knownFactorCount(item)) &&
    recommendedKnown > 0
  ) {
    reasons.push({
      kind: 'stronger_evidence',
      text: 'Provvy currently has more complete evidence for this route than the other candidates.',
    });
  }

  return reasons.slice(0, 4);
}

function collectTradeoffs(
  recommended: RouteDecisionAssessment,
  alternatives: RouteDecisionAssessment[],
  offeringNames?: Readonly<Record<string, string>>
): RecommendationNote[] {
  const notes: RecommendationNote[] = [];

  if (recommended.tradeoffs.includes('underlying_rail_not_evidenced')) {
    notes.push({
      kind: 'underlying_rail_not_evidenced',
      text: 'The underlying payment rail is not currently evidenced.',
    });
  }

  if (recommended.tradeoffs.includes('regulatory_restriction_on_rail')) {
    notes.push({
      kind: 'regulatory_restriction_on_rail',
      text: 'A sourced regulatory restriction currently applies to this route.',
    });
  }

  if (recommended.tradeoffs.includes('capability_unspecified')) {
    notes.push({
      kind: 'capability_unspecified',
      text: 'Corridor capability is not yet specified for this payment.',
    });
  }

  const peer = alternatives.find(
    (item) =>
      item.recommendable &&
      item.route.offeringId !== recommended.route.offeringId &&
      item.positives.includes('known_total_economic_outcome') &&
      recommended.positives.includes('corridor_capability_supported') &&
      !item.positives.includes('corridor_capability_supported')
  );
  if (peer) {
    const peerName = offeringNames?.[peer.route.offeringId];
    notes.push({
      kind: 'peer_economic_without_capability',
      text: peerName
        ? `${peerName} has comparable economic evidence, but Provvy has stronger corridor evidence for this route.`
        : 'Another available route has comparable economic evidence, but Provvy has stronger corridor evidence for this route.',
    });
  }

  return notes.slice(0, 3);
}

function collectUnknowns(recommended: RouteDecisionAssessment): RecommendationNote[] {
  const notes: RecommendationNote[] = [];
  const seen = new Set<string>();

  const push = (kind: string, text: string) => {
    if (seen.has(kind)) return;
    seen.add(kind);
    notes.push({ kind, text });
  };

  if (recommended.unknowns.some((item) => item.includes(':stale'))) {
    push('stale_evidence', 'Some available route evidence is stale.');
  }
  if (recommended.economic.fx.observation?.value.rateKind === 'indicative') {
    push('indicative_fx', 'Available FX figures are indicative, not a sourced executable quote.');
  }
  if (recommended.tradeoffs.includes('underlying_rail_not_evidenced') || recommended.unknowns.some((item) => item.startsWith('route_specificity:'))) {
    push('unknown_network_rail', "Underlying payment rail isn't currently evidenced.");
  }
  if (
    recommended.unknowns.some((item) => item.startsWith('explicit_fee:') || item.startsWith('fx_outcome:') || item.startsWith('total_economic_outcome:')) ||
    recommended.tradeoffs.includes('economic_outcome_not_computed')
  ) {
    push('missing_provider_quote', "Current provider quote isn't available.");
  }
  if (recommended.unknowns.some((item) => item.startsWith('settlement:'))) {
    push('incomplete_settlement', 'Settlement timing evidence is incomplete.');
  }
  if (recommended.unknowns.some((item) => item.startsWith('availability:'))) {
    push('incomplete_availability', 'Route availability evidence is incomplete.');
  }

  return notes.slice(0, 3);
}

function collectEvidence(recommended: RouteDecisionAssessment, paymentSourceCurrency: string): RecommendationEvidenceRef[] {
  const seen = new Set<string>();
  const refs: RecommendationEvidenceRef[] = [];
  for (const item of recommended.evidenceRefs) {
    const host = evidenceHost(item.sourceUrl);
    if (!host || seen.has(host)) continue;
    if (host === 'www.ecb.europa.eu' && paymentSourceCurrency !== 'EUR') continue;
    seen.add(host);
    refs.push({ label: evidenceLabel(host), host });
  }
  return refs;
}

function emptyExplanation(
  status: Exclude<RecommendationExplanationStatus, 'explained'>,
  context: RecommendationExplanationContext,
  decision: RouteDecision
): RecommendationExplanation {
  return {
    status,
    displayedOfferingId: context.displayedOfferingId,
    displayedProviderName: context.displayedProviderName,
    objective: decision.payment.priority,
    objectiveLabel: OBJECTIVE_LABEL[decision.payment.priority],
    confidence: null,
    reasons: [],
    tradeoffs: [],
    unknowns: [],
    evidence: [],
    summary: status === 'disagreement' ? DISAGREEMENT_SUMMARY : INSUFFICIENT_SUMMARY,
  };
}

/**
 * Presentation-safe mapping from a shadow decision payload.
 * Never invents facts, percentages, or live-pricing claims.
 */
export function toRecommendationExplanation(
  decision: RouteDecision,
  context: RecommendationExplanationContext
): RecommendationExplanation {
  const agrees =
    context.comparison.sameRecommendation &&
    decision.recommended?.route.offeringId === context.displayedOfferingId;

  if (!agrees || !decision.recommended) {
    return emptyExplanation('disagreement', context, decision);
  }

  const alternatives = decision.alternatives;
  const reasons = collectReasons(decision.recommended, alternatives);
  const tradeoffs = collectTradeoffs(decision.recommended, alternatives, context.offeringNames);
  const unknowns = collectUnknowns(decision.recommended);
  const evidence = collectEvidence(decision.recommended, decision.payment.sourceCurrency);

  if (reasons.length === 0 && tradeoffs.length === 0 && unknowns.length === 0) {
    return emptyExplanation('insufficient', context, decision);
  }

  return {
    status: 'explained',
    displayedOfferingId: context.displayedOfferingId,
    displayedProviderName: context.displayedProviderName,
    objective: decision.payment.priority,
    objectiveLabel: OBJECTIVE_LABEL[decision.payment.priority],
    confidence: {
      level: decision.confidence.level,
      label: confidenceDisplayLabel(decision.confidence.level),
    },
    reasons,
    tradeoffs,
    unknowns,
    evidence,
    summary: `${context.displayedProviderName} is the displayed recommendation, with ${confidenceDisplayLabel(decision.confidence.level).toLowerCase()} confidence from current route evidence.`,
  };
}

export function explanationContainsFabricatedClaim(explanation: RecommendationExplanation): boolean {
  const text = [
    explanation.summary,
    ...explanation.reasons.map((item) => item.text),
    ...explanation.tradeoffs.map((item) => item.text),
    ...explanation.unknowns.map((item) => item.text),
  ].join(' ');
  return /(%|98%|live pricing|live quotes|executable quote guaranteed|cheapest route|fastest route|guaranteed settlement)/i.test(
    text
  );
}
