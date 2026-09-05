import { LANDING_COMPARISON_DISCLAIMER, type LandingComparedRoute, type LandingSearchQuery } from '@/lib/journey/landing-route-model';
import {
  buildContextLine,
  buildPriorityOutlook,
  buildRecommendation,
  LANDING_GENERIC_CONFIDENCE,
  presentLandingRoute,
  whatCouldChangeTheRecommendation,
  type LandingGenericConfidence,
  type LandingPriorityOutlook,
  type LandingRecommendation,
} from '@/lib/journey/landing-route-intelligence';
import { rankLandingRoutes } from '@/lib/journey/landing-route-rank';
import {
  buildProviderResults,
  recommendedWhy,
  type LandingProviderResult,
} from '@/lib/journey/landing-provider-search';

export {
  countryName,
  DEFAULT_LANDING_SEARCH,
  formatLandingAmount,
  isDomestic,
  isLandingCountryCode,
  isLandingPriorityId,
  isLandingTransactionTypeId,
  LANDING_COMPARISON_DISCLAIMER,
  LANDING_CONTEXT_SIGNALS,
  LANDING_COUNTRIES,
  LANDING_CURRENCIES,
  LANDING_PRIORITIES,
  LANDING_TRANSACTION_TYPES,
  landingSearchIsValid,
  objectiveFromLandingSearch,
  parseLandingAmount,
  priorityLabel,
  transactionTypeLabel,
} from '@/lib/journey/landing-route-model';

export { rankLandingRoutes } from '@/lib/journey/landing-route-rank';

export type {
  LandingComparedRoute,
  LandingCountryCode,
  LandingPriorityId,
  LandingRouteId,
  LandingSearchQuery,
  LandingTransactionTypeId,
} from '@/lib/journey/landing-route-model';

export type {
  LandingGenericConfidence,
  LandingPriorityOutlook,
  LandingRecommendation,
} from '@/lib/journey/landing-route-intelligence';

export type { LandingProviderResult } from '@/lib/journey/landing-provider-search';

export type LandingComparisonResult = {
  query: LandingSearchQuery;
  offerings: LandingProviderResult[];
  genericBest: LandingComparedRoute;
  recommendedOffering: LandingProviderResult;
  recommendedWhy: string;
  recommendation: LandingRecommendation;
  priorityOutlook: LandingPriorityOutlook[];
  whatCouldChange: string[];
  confidence: LandingGenericConfidence;
  headline: string;
  contextLine: string;
  disclaimer: string;
  routes: LandingComparedRoute[];
};

export function compareLandingRoutes(query: LandingSearchQuery): LandingComparisonResult {
  const ranked = rankLandingRoutes(query);
  const routes = ranked.map((entry, index) => ({
    ...presentLandingRoute(entry.id, query),
    isGenericBest: index === 0,
  }));
  const genericBest = routes[0];
  const offerings = buildProviderResults(query);
  const recommendedOffering = offerings.find((item) => item.isRecommended) ?? offerings[0];

  if (!genericBest || !recommendedOffering) {
    throw new Error('Landing comparison produced no routes');
  }

  const outlook = buildPriorityOutlook(query, (next) => rankLandingRoutes(next));
  const recommendation = buildRecommendation(genericBest.id, query, outlook);

  return {
    query,
    offerings,
    genericBest,
    recommendedOffering,
    recommendedWhy: recommendedWhy(recommendedOffering, query),
    recommendation,
    priorityOutlook: outlook,
    whatCouldChange: whatCouldChangeTheRecommendation(query),
    confidence: LANDING_GENERIC_CONFIDENCE,
    headline: `Provvy recommends ${recommendedOffering.offering.providerName}.`,
    contextLine: buildContextLine(query),
    disclaimer: LANDING_COMPARISON_DISCLAIMER,
    routes,
  };
}
