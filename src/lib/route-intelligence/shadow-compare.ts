import type {
  RankingShadowRef,
  RouteDecision,
  ShadowDecisionComparison,
} from '@/lib/route-intelligence/decision-types';

function decisionOrder(decision: RouteDecision): string[] {
  const ids: string[] = [];
  if (decision.recommended) ids.push(decision.recommended.route.offeringId);
  for (const item of decision.alternatives) {
    if (item.recommendable) ids.push(item.route.offeringId);
  }
  return ids;
}

/**
 * Internal shadow comparison of existing ranking vs Phase 9 decision.
 * Not a public API and not consumed by compareLandingRoutes.
 */
export function compareShadowDecision(
  ranking: RankingShadowRef,
  decision: RouteDecision
): ShadowDecisionComparison {
  const decisionRecommendedOfferingId = decision.recommended?.route.offeringId ?? null;
  const sameRecommendation = ranking.recommendedOfferingId === decisionRecommendedOfferingId;
  const decisionIds = decisionOrder(decision);
  const changedOrdering =
    ranking.orderedOfferingIds.length !== decisionIds.length ||
    ranking.orderedOfferingIds.some((id, index) => id !== decisionIds[index]);
  const insufficientEvidence =
    !decision.recommended ||
    decision.confidence.level === 'unknown' ||
    decision.confidence.level === 'low';

  const divergenceReasons: string[] = [];
  if (!sameRecommendation) divergenceReasons.push('recommendation_differs');
  if (changedOrdering) divergenceReasons.push('ordering_differs');
  if (insufficientEvidence) divergenceReasons.push('decision_evidence_limited');
  if (decision.recommended?.tradeoffs.includes('underlying_rail_not_evidenced')) {
    divergenceReasons.push('decision_rail_unknown');
  }
  if (decision.recommended && decision.recommended.totalCost.state !== 'known') {
    divergenceReasons.push('decision_economics_unknown');
  }

  return {
    sameRecommendation,
    changedRecommendation: !sameRecommendation,
    changedOrdering,
    insufficientEvidence,
    divergenceReasons,
    rankingRecommendedOfferingId: ranking.recommendedOfferingId,
    decisionRecommendedOfferingId,
  };
}
