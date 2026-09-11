import { evaluateOfferingCoverage } from '@/lib/route-intelligence/coverage';
import { evaluateDecisionConfidence } from '@/lib/route-intelligence/decision-confidence';
import type {
  DecisionCandidate,
  DecisionFactor,
  DecisionIntelligence,
  DecisionPayment,
  RouteDecision,
  RouteDecisionAssessment,
} from '@/lib/route-intelligence/decision-types';
import { getRouteEconomicState } from '@/lib/route-intelligence/economic-state';
import { isUnknownNetworkRail } from '@/lib/route-intelligence/network-rail';
import { evaluateRegulatoryRouteImpacts } from '@/lib/route-intelligence/regulatory-impact';
import { evaluateRouteEligibility, routeIsNotExcluded } from '@/lib/route-intelligence/route-eligibility';
import { evaluateRouteImpact } from '@/lib/route-intelligence/route-impact';
import { toRouteImpactSubject } from '@/lib/route-intelligence/route-subject';
import { calculateTotalCost } from '@/lib/route-intelligence/total-cost';
import type { LandingSearchQuery } from '@/lib/journey/landing-route-model';
import type { SettlementBand } from '@/lib/route-intelligence/types';

const SETTLEMENT_RANK: Record<SettlementBand, number> = {
  instant: 0,
  minutes: 1,
  same_day: 2,
  next_business_day: 3,
  multi_day: 4,
  unknown: 5,
};

/**
 * Isolated shadow selection policy. Not rankLandingRoutes.
 * Lexicographic and explicit: exclusion first, then objective evidence,
 * then completeness. No hidden universal "best rail" score.
 */
function regulatoryPreferred(assessment: RouteDecisionAssessment): boolean {
  return !assessment.regulatory.some((item) => item.status === 'affected');
}

function knownCost(assessment: RouteDecisionAssessment): boolean {
  return assessment.totalCost.state === 'known';
}

function destinationValue(assessment: RouteDecisionAssessment): number {
  return assessment.totalCost.state === 'known' ? assessment.totalCost.destinationAmount : Number.NEGATIVE_INFINITY;
}

function explicitFee(assessment: RouteDecisionAssessment): number {
  return assessment.totalCost.state === 'known' ? assessment.totalCost.explicitFeeAmount : Number.POSITIVE_INFINITY;
}

function settlementRank(assessment: RouteDecisionAssessment): number {
  const band = assessment.economic.settlement.observation?.value.band;
  if (assessment.economic.settlement.state !== 'known' || !band) return SETTLEMENT_RANK.unknown;
  return SETTLEMENT_RANK[band];
}

function evidenceCount(assessment: RouteDecisionAssessment): number {
  return assessment.factors.filter((factor) => factor.state === 'known').length;
}

function simplestScore(assessment: RouteDecisionAssessment): number {
  let score = 0;
  if (assessment.coverage.status === 'supported') score += 1;
  if (assessment.economic.availability.state === 'known' && assessment.economic.availability.observation?.value.status === 'available') {
    score += 1;
  }
  if (assessment.operational.overallImpact === 'not_affected') score += 1;
  return score;
}

function compareRecommendable(
  left: RouteDecisionAssessment,
  right: RouteDecisionAssessment,
  payment: DecisionPayment
): number {
  const leftReg = regulatoryPreferred(left) ? 0 : 1;
  const rightReg = regulatoryPreferred(right) ? 0 : 1;
  if (leftReg !== rightReg) return leftReg - rightReg;

  if (payment.priority === 'lowest_cost') {
    const leftKnown = knownCost(left) ? 0 : 1;
    const rightKnown = knownCost(right) ? 0 : 1;
    if (leftKnown !== rightKnown) return leftKnown - rightKnown;
    if (knownCost(left) && knownCost(right)) {
      const dest = destinationValue(right) - destinationValue(left);
      if (dest !== 0) return dest;
      const fee = explicitFee(left) - explicitFee(right);
      if (fee !== 0) return fee;
    }
  }

  if (payment.priority === 'fastest') {
    const settle = settlementRank(left) - settlementRank(right);
    if (settle !== 0) return settle;
  }

  if (payment.priority === 'simplest') {
    const simple = simplestScore(right) - simplestScore(left);
    if (simple !== 0) return simple;
  }

  const evidence = evidenceCount(right) - evidenceCount(left);
  if (evidence !== 0) return evidence;
  return left.route.offeringId.localeCompare(right.route.offeringId);
}

function factor(
  kind: DecisionFactor['kind'],
  state: DecisionFactor['state'],
  summary: string,
  evidenceUrls: Array<string | null | undefined>
): DecisionFactor {
  return {
    kind,
    state,
    summary,
    evidenceUrls: evidenceUrls.filter((url): url is string => Boolean(url?.trim())),
  };
}

function assessCandidate(
  candidate: DecisionCandidate,
  payment: DecisionPayment,
  intelligence: DecisionIntelligence
): RouteDecisionAssessment {
  const now = intelligence.now ?? new Date();
  const route = candidate.route;
  const coverageQuery = {
    origin: payment.origin,
    destination: payment.destination,
    sourceCurrency: payment.sourceCurrency,
    destinationCurrency: payment.destinationCurrency,
    transactionType: payment.transactionType,
  };
  const coverage = evaluateOfferingCoverage(
    route.offeringId,
    coverageQuery,
    intelligence.capabilities ?? []
  );
  const impactSubject = toRouteImpactSubject(route);
  const eligibility = evaluateRouteEligibility(impactSubject, {
    health: intelligence.health,
    incidents: intelligence.incidents,
    now,
  });
  const operational = evaluateRouteImpact(impactSubject, {
    health: intelligence.health,
    incidents: intelligence.incidents,
    now,
  });
  const regulatory = evaluateRegulatoryRouteImpacts([route], intelligence.regulatoryObservations ?? [], {
    paymentType: payment.transactionType,
    now,
  });
  const economic = getRouteEconomicState(
    route,
    {
      feeObservations: intelligence.feeObservations,
      fxObservations: intelligence.fxObservations,
      settlementObservations: intelligence.settlementObservations,
      availabilityObservations: intelligence.availabilityObservations,
    },
    { now, amount: payment.amount, paymentType: payment.transactionType }
  );
  const totalCost = calculateTotalCost(economic);

  const freshnessState =
    [economic.fee, economic.fx, economic.settlement, economic.availability].some((item) => item.state === 'stale')
      ? 'stale'
      : [economic.fee, economic.fx, economic.settlement, economic.availability].some((item) => item.state === 'known')
        ? 'known'
        : 'unavailable';

  const regulatoryState = regulatory.some((item) => item.status === 'affected')
    ? 'known'
    : regulatory.some((item) => item.status === 'unknown')
      ? 'unknown'
      : intelligence.regulatoryObservations?.length
        ? 'known'
        : 'unavailable';

  const factors: DecisionFactor[] = [
    factor(
      'corridor_capability',
      coverage.status === 'supported' ? 'known' : coverage.status === 'unsupported' ? 'known' : 'unavailable',
      `capability:${coverage.status}`,
      []
    ),
    factor(
      'operational_health',
      operational.operationalHealth.freshness === 'stale'
        ? 'stale'
        : operational.operationalHealth.freshness === 'missing'
          ? 'unavailable'
          : 'known',
      `operational:${operational.overallImpact}`,
      [operational.operationalHealth.sourceUrl]
    ),
    factor(
      'regulatory_state',
      regulatoryState,
      `regulatory:${regulatory.some((item) => item.status === 'affected') ? 'affected' : 'not_affected'}`,
      regulatory.map((item) => item.sourceUrl)
    ),
    factor(
      'explicit_fee',
      economic.fee.state,
      `fee:${economic.fee.state}`,
      [economic.fee.sourceUrl]
    ),
    factor(
      'fx_outcome',
      economic.fx.state,
      `fx:${economic.fx.state}:${economic.fx.observation?.value.rateKind ?? 'none'}`,
      [economic.fx.sourceUrl]
    ),
    factor(
      'total_economic_outcome',
      totalCost.state === 'known' ? 'known' : economic.fee.state === 'stale' || economic.fx.state === 'stale' ? 'stale' : 'unavailable',
      totalCost.state === 'known' ? `total_cost:${totalCost.method}` : `total_cost:${totalCost.reason}`,
      [economic.fee.sourceUrl, economic.fx.sourceUrl]
    ),
    factor(
      'settlement',
      economic.settlement.state,
      `settlement:${economic.settlement.observation?.value.band ?? economic.settlement.state}`,
      [economic.settlement.sourceUrl]
    ),
    factor(
      'availability',
      economic.availability.state,
      `availability:${economic.availability.observation?.value.status ?? economic.availability.state}`,
      [economic.availability.sourceUrl]
    ),
    factor(
      'evidence_confidence',
      economic.confidence.level === 'unavailable' ? 'unavailable' : 'known',
      `economic_confidence:${economic.confidence.level}`,
      []
    ),
    factor('freshness', freshnessState, `freshness:${freshnessState}`, []),
    factor(
      'route_specificity',
      isUnknownNetworkRail(route.networkRail) ? 'unknown' : 'known',
      `rail:${route.networkRail}`,
      []
    ),
  ];

  const positives: string[] = [];
  const tradeoffs: string[] = [];
  const unknowns: string[] = [];

  if (coverage.status === 'supported') positives.push('corridor_capability_supported');
  if (operational.overallImpact === 'not_affected' && operational.operationalHealth.freshness === 'fresh') {
    positives.push('fresh_operational_not_affected');
  }
  if (totalCost.state === 'known') positives.push('known_total_economic_outcome');
  if (economic.availability.state === 'known' && economic.availability.observation?.value.status === 'available') {
    positives.push('route_available');
  }

  if (isUnknownNetworkRail(route.networkRail)) tradeoffs.push('underlying_rail_not_evidenced');
  if (regulatory.some((item) => item.status === 'affected')) tradeoffs.push('regulatory_restriction_on_rail');
  if (coverage.status === 'unspecified') tradeoffs.push('capability_unspecified');
  if (totalCost.state !== 'known') tradeoffs.push('economic_outcome_not_computed');

  for (const item of factors) {
    if (item.state === 'unknown' || item.state === 'unavailable' || item.state === 'stale') {
      unknowns.push(`${item.kind}:${item.state}`);
    }
  }

  const evidenceRefs = factors.flatMap((item) =>
    item.evidenceUrls.map((sourceUrl) => ({ label: item.kind, sourceUrl }))
  );

  return {
    route,
    recommendable: coverage.eligible && routeIsNotExcluded(eligibility),
    coverage,
    eligibility,
    operational,
    regulatory,
    economic,
    totalCost,
    factors,
    positives,
    tradeoffs,
    unknowns,
    evidenceRefs,
  };
}

export function decisionPaymentFromSearch(query: LandingSearchQuery): DecisionPayment {
  return {
    origin: query.originCountry,
    destination: query.destinationCountry,
    sourceCurrency: query.currency,
    destinationCurrency: query.destinationCurrency ?? null,
    amount: query.amount,
    transactionType: query.transactionType,
    priority: query.priority,
  };
}

/**
 * Shadow evidence-backed decision. Pure and side-effect free.
 * Does not fetch, persist, call an LLM, or change rankLandingRoutes.
 */
export function decideRoute(
  payment: DecisionPayment,
  candidates: readonly DecisionCandidate[],
  intelligence: DecisionIntelligence = {}
): RouteDecision {
  const assessments = candidates.map((candidate) => assessCandidate(candidate, payment, intelligence));
  const recommendable = assessments.filter((item) => item.recommendable);
  const excluded = assessments.filter((item) => !item.recommendable);

  const ordered = [...recommendable].sort((left, right) => compareRecommendable(left, right, payment));
  const recommended = ordered[0] ?? null;
  const alternatives = [...ordered.slice(1), ...excluded];
  const confidence = evaluateDecisionConfidence(recommended);

  const decisionNotes = [
    'mode:shadow',
    `objective:${payment.priority}`,
    `recommendable:${recommendable.length}`,
    `excluded:${excluded.length}`,
    'policy:exclusion_then_objective_evidence_then_completeness',
    'not:rankLandingRoutes',
  ];

  return {
    mode: 'shadow',
    payment,
    recommended,
    alternatives,
    confidence,
    decisionNotes,
  };
}
