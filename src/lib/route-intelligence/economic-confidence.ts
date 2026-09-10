import { isUnknownNetworkRail } from '@/lib/route-intelligence/network-rail';
import type {
  EconomicConfidence,
  EconomicFact,
  EconomicFactState,
  RouteEconomicState,
} from '@/lib/route-intelligence/types';

function factKnown(fact: EconomicFact<unknown>): boolean {
  return fact.state === 'known';
}

function factStale(fact: EconomicFact<unknown>): boolean {
  return fact.state === 'stale';
}

function externallySourced(fact: EconomicFact<unknown>): boolean {
  return fact.provenance === 'externally_sourced';
}

/**
 * Deterministic economic confidence. Not an LLM score.
 * High requires complete, fresh, externally sourced, route-specific evidence.
 * Existing data alone is not enough for high.
 */
export function evaluateEconomicConfidence(
  state: Omit<RouteEconomicState, 'confidence'>
): EconomicConfidence {
  const facts = [state.fee, state.fx, state.settlement, state.availability];
  const knownCount = facts.filter(factKnown).length;
  const reasons: string[] = [];

  if (knownCount === 0) {
    return { level: 'unavailable', reasons: ['no_economic_evidence'] };
  }

  if (facts.some(factStale)) {
    reasons.push('stale_evidence');
  }
  if (facts.some((fact) => fact.state === 'unknown' || fact.state === 'unavailable')) {
    reasons.push('incomplete_evidence');
  }
  if (facts.some((fact) => fact.observation && !externallySourced(fact))) {
    reasons.push('non_external_provenance');
  }
  if (isUnknownNetworkRail(state.route.networkRail)) {
    reasons.push('unknown_network_rail');
  }
  if (!state.route.currencyPair.source || !state.route.currencyPair.target) {
    reasons.push('incomplete_currency_pair');
  }

  const complete =
    knownCount === 4 &&
    facts.every(externallySourced) &&
    !facts.some(factStale) &&
    !isUnknownNetworkRail(state.route.networkRail) &&
    Boolean(state.route.currencyPair.source && state.route.currencyPair.target);

  if (complete) {
    return { level: 'high', reasons: ['complete_fresh_external_route_specific'] };
  }
  if (reasons.includes('stale_evidence') || reasons.includes('non_external_provenance')) {
    reasons.push(`known_dimensions:${knownCount}`);
    return { level: 'low', reasons };
  }
  if (knownCount >= 3) {
    reasons.push(`known_dimensions:${knownCount}`);
    return { level: 'moderate', reasons };
  }
  reasons.push(`known_dimensions:${knownCount}`);
  return { level: 'low', reasons };
}

export function economicFactStateLabel(state: EconomicFactState): EconomicFactState {
  return state;
}
