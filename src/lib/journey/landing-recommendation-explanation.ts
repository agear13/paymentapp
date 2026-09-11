import type { LandingComparisonResult } from '@/lib/journey/landing-route-comparison';
import {
  compareShadowDecision,
  createRouteSubject,
  decideRoute,
  decisionPaymentFromSearch,
  getPublicRouteIntelligenceSnapshot,
  resolveOfferingRail,
  toRecommendationExplanation,
  type DecisionIntelligence,
  type RecommendationExplanation,
} from '@/lib/route-intelligence';

/**
 * Derive a customer-facing explanation from already-available structured data.
 * Does not fetch, does not change public ranking, and does not select the winner.
 */
export function explainLandingRecommendation(
  result: LandingComparisonResult,
  intelligence: DecisionIntelligence = {}
): RecommendationExplanation {
  const snapshot = getPublicRouteIntelligenceSnapshot();
  const payment = decisionPaymentFromSearch(result.query);
  const candidates = result.offerings.map((item) => ({
    route: createRouteSubject({
      providerId: item.offering.providerId,
      offeringId: item.offering.id,
      mechanismId: item.offering.mechanism,
      corridor: {
        origin: result.query.originCountry,
        destination: result.query.destinationCountry,
      },
      sourceCurrency: result.query.currency,
      destinationCurrency: result.query.destinationCurrency ?? null,
      networkRail: resolveOfferingRail({
        providerId: item.offering.providerId,
        offeringId: item.offering.id,
        mechanismId: item.offering.mechanism,
      }),
    }),
  }));

  const decision = decideRoute(payment, candidates, {
    capabilities: intelligence.capabilities ?? snapshot.capabilities,
    health: intelligence.health,
    incidents: intelligence.incidents,
    regulatoryObservations: intelligence.regulatoryObservations,
    feeObservations: intelligence.feeObservations,
    fxObservations: intelligence.fxObservations,
    settlementObservations: intelligence.settlementObservations,
    availabilityObservations: intelligence.availabilityObservations,
    now: intelligence.now,
  });

  const comparison = compareShadowDecision(
    {
      recommendedOfferingId: result.recommendedOffering.id,
      orderedOfferingIds: result.offerings.map((item) => item.id),
    },
    decision
  );

  const offeringNames = Object.fromEntries(
    result.offerings.map((item) => [item.id, item.offering.providerName])
  );

  return toRecommendationExplanation(decision, {
    displayedOfferingId: result.recommendedOffering.id,
    displayedProviderName: result.recommendedOffering.offering.providerName,
    comparison,
    offeringNames,
  });
}
