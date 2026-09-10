import { evaluateEconomicConfidence } from '@/lib/route-intelligence/economic-confidence';
import {
  availabilityObservationAppliesToRoute,
  fxObservationAppliesToRoute,
  settlementObservationAppliesToRoute,
} from '@/lib/route-intelligence/economic-observation';
import { feeObservationAppliesToRoute, isObservationFresh } from '@/lib/route-intelligence/observation';
import type {
  EconomicFact,
  EconomicFactState,
  ProviderFeeObservation,
  RouteAvailabilityObservation,
  RouteEconomicState,
  RouteFxObservation,
  RouteSettlementObservation,
  RouteSubject,
} from '@/lib/route-intelligence/types';

export type RouteEconomicObservations = {
  feeObservations?: readonly ProviderFeeObservation[];
  fxObservations?: readonly RouteFxObservation[];
  settlementObservations?: readonly RouteSettlementObservation[];
  availabilityObservations?: readonly RouteAvailabilityObservation[];
};

export type RouteEconomicQuery = {
  now?: Date;
  amount?: number | null;
  paymentType?: string | null;
};

function freshnessOf(
  observation: { fetchedAt: string; staleAfter: string } | null,
  now: Date
): { state: EconomicFactState; freshness: 'fresh' | 'stale' | 'missing' } {
  if (!observation) {
    return { state: 'unavailable', freshness: 'missing' };
  }
  if (!isObservationFresh(observation, now)) {
    return { state: 'stale', freshness: 'stale' };
  }
  return { state: 'known', freshness: 'fresh' };
}

function toFact<T extends { sourceUrl: string; provenance: 'externally_sourced' | 'curated' }>(
  observation: T | null,
  now: Date
): EconomicFact<T> {
  const freshness = freshnessOf(observation, now);
  return {
    state: freshness.state,
    freshness: freshness.freshness,
    observation: observation,
    sourceUrl: observation?.sourceUrl ?? null,
    provenance: observation?.provenance ?? null,
  };
}

function latestMatching<T extends { fetchedAt: string }>(items: T[]): T | null {
  if (items.length === 0) return null;
  return [...items].sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))[0] ?? null;
}

/**
 * Pure aggregation. Missing/stale/unknown stay distinct.
 * Catalog PricingSnapshot / FXSnapshot / SettlementSignal are not inputs.
 */
export function getRouteEconomicState(
  route: RouteSubject,
  observations: RouteEconomicObservations = {},
  query: RouteEconomicQuery = {}
): RouteEconomicState {
  const now = query.now ?? new Date();
  const amount = query.amount ?? null;

  const fee = latestMatching(
    (observations.feeObservations ?? []).filter((item) =>
      feeObservationAppliesToRoute(item, route, amount)
    )
  );
  const fx = latestMatching(
    (observations.fxObservations ?? []).filter((item) =>
      fxObservationAppliesToRoute(item, route, amount)
    )
  );
  const settlement = latestMatching(
    (observations.settlementObservations ?? []).filter((item) =>
      settlementObservationAppliesToRoute(item, route)
    )
  );
  const availability = latestMatching(
    (observations.availabilityObservations ?? []).filter((item) =>
      availabilityObservationAppliesToRoute(item, route, query.paymentType)
    )
  );

  const withoutConfidence = {
    route,
    amount,
    fee: toFact(fee, now),
    fx: toFact(fx, now),
    settlement: toFact(settlement, now),
    availability: toFact(availability, now),
  };

  return {
    ...withoutConfidence,
    confidence: evaluateEconomicConfidence(withoutConfidence),
  };
}
