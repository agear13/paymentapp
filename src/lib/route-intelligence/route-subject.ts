import type {
  Corridor,
  MechanismId,
  NetworkRailId,
  Offering,
  ProviderId,
  RouteImpactSubject,
  RouteSubject,
} from '@/lib/route-intelligence/types';

const KEY_EMPTY = '-';

function keyPart(value: string | null | undefined): string {
  return value && value.trim() ? value : KEY_EMPTY;
}

/**
 * Stable route identity. Amount is excluded so A$10,000 and A$100,000
 * quotes can attach to the same route without collapsing into one identity.
 * Formula: provider|offering|mechanism|origin|destination|source|target|rail
 */
export function routeSubjectKey(subject: RouteSubject): string {
  return [
    subject.providerId,
    subject.offeringId,
    subject.mechanismId,
    subject.corridor.origin,
    subject.corridor.destination,
    keyPart(subject.currencyPair.source),
    keyPart(subject.currencyPair.target),
    subject.networkRail,
  ].join('|');
}

export function createRouteSubject(input: {
  providerId: ProviderId;
  offeringId: string;
  mechanismId: MechanismId;
  corridor: Corridor;
  sourceCurrency?: string | null;
  destinationCurrency?: string | null;
  networkRail: NetworkRailId;
}): RouteSubject {
  return {
    providerId: input.providerId,
    offeringId: input.offeringId,
    mechanismId: input.mechanismId,
    corridor: input.corridor,
    currencyPair: {
      source: input.sourceCurrency ?? null,
      target: input.destinationCurrency ?? null,
    },
    networkRail: input.networkRail,
  };
}

export function routeSubjectFromOffering(
  offering: Pick<Offering, 'id' | 'provider' | 'mechanism'>,
  input: {
    corridor: Corridor;
    sourceCurrency?: string | null;
    destinationCurrency?: string | null;
    networkRail: NetworkRailId;
  }
): RouteSubject {
  return createRouteSubject({
    providerId: offering.provider.id,
    offeringId: offering.id,
    mechanismId: offering.mechanism,
    corridor: input.corridor,
    sourceCurrency: input.sourceCurrency,
    destinationCurrency: input.destinationCurrency,
    networkRail: input.networkRail,
  });
}

/**
 * Narrower operational-evaluation view. Does not invent a destination currency
 * or a rail. Missing destination currency stays off the pair rather than
 * copying the source (AUD → AUD is not a valid fallback).
 */
export function toRouteImpactSubject(subject: RouteSubject): RouteImpactSubject {
  const source = subject.currencyPair.source;
  const target = subject.currencyPair.target;
  return {
    offeringId: subject.offeringId,
    providerId: subject.providerId,
    corridor: subject.corridor,
    currencyPair: source && target ? { source, target } : null,
  };
}

export function sameRouteSubject(left: RouteSubject, right: RouteSubject): boolean {
  return routeSubjectKey(left) === routeSubjectKey(right);
}
