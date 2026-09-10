import {
  evaluateLatestObservation,
  incidentAffectsComponent,
  isObservationFresh,
  WISE_API_COMPONENT_ID,
  WISE_PAYMENTS_COMPONENT_ID,
  WISE_WEBSITE_COMPONENT_ID,
} from '@/lib/route-intelligence/observation';
import type {
  HealthImpactEvaluation,
  IncidentImpactEvaluation,
  LatestObservationRead,
  ProviderOperationalHealthObservation,
  ProviderPaymentIncidentObservation,
  RouteImpactEvaluation,
  RouteImpactReason,
  RouteImpactStatus,
  RouteImpactSubject,
  StructuredRouteEvidence,
} from '@/lib/route-intelligence/types';

const DEGRADED_HEALTH = new Set(['degraded_performance', 'partial_outage', 'major_outage']);

function emptyHealth(
  status: RouteImpactStatus,
  reason: RouteImpactReason,
  freshness: HealthImpactEvaluation['freshness']
): HealthImpactEvaluation {
  return {
    observationType: 'provider_operational_health',
    status,
    reason,
    freshness,
    componentStatus: null,
    sourceUrl: null,
    observedAt: null,
    provenance: null,
  };
}

export function evaluateOperationalHealthImpact(
  route: RouteImpactSubject,
  health: LatestObservationRead | ProviderOperationalHealthObservation | null | undefined,
  now: Date = new Date()
): HealthImpactEvaluation {
  const read =
    health && 'kind' in health ? health : evaluateLatestObservation(health ?? null, now);

  if (read.kind === 'unavailable') {
    return emptyHealth('unknown', 'missing_observation', 'missing');
  }

  const observation = read.observation;
  const base = {
    observationType: 'provider_operational_health' as const,
    componentStatus: observation.value.componentStatus,
    sourceUrl: observation.sourceUrl,
    observedAt: observation.observedAt,
    provenance: observation.provenance,
  };

  if (read.kind === 'stale') {
    return { ...base, status: 'unknown', reason: 'stale_observation', freshness: 'stale' };
  }

  if (observation.providerId !== route.providerId) {
    return { ...base, status: 'not_affected', reason: 'provider_mismatch', freshness: 'fresh' };
  }

  if (observation.value.componentId !== WISE_PAYMENTS_COMPONENT_ID) {
    return {
      ...base,
      status: observation.value.componentId === WISE_WEBSITE_COMPONENT_ID ? 'not_affected' : 'unknown',
      reason:
        observation.value.componentId === WISE_WEBSITE_COMPONENT_ID
          ? 'non_payment_component'
          : 'unknown_component_dependency',
      freshness: 'fresh',
    };
  }

  if (observation.value.componentStatus === 'operational') {
    return {
      ...base,
      status: 'not_affected',
      reason: 'provider_operational_health',
      freshness: 'fresh',
    };
  }

  if (DEGRADED_HEALTH.has(observation.value.componentStatus)) {
    return {
      ...base,
      status: 'affected',
      reason: 'provider_operational_health',
      freshness: 'fresh',
    };
  }

  return { ...base, status: 'unknown', reason: 'insufficient_evidence', freshness: 'fresh' };
}

function structuredMatchReason(
  structured: StructuredRouteEvidence,
  matchedBy: 'corridor' | 'currency'
): RouteImpactReason {
  if (matchedBy === 'corridor') return 'explicit_corridor_match';
  return structured.destinationCurrency || structured.sourceCurrency || structured.currencyPair
    ? 'explicit_currency_match'
    : 'explicit_corridor_match';
}

function matchStructuredRoute(
  route: RouteImpactSubject,
  structured: StructuredRouteEvidence | null | undefined
): { result: 'affected' | 'not_affected' | 'none'; reason?: RouteImpactReason } {
  if (!structured) return { result: 'none' };

  const origin = structured.corridor?.origin ?? structured.origin ?? null;
  const destination = structured.corridor?.destination ?? structured.destination ?? null;
  const sourceCurrency = structured.currencyPair?.source ?? structured.sourceCurrency ?? null;
  const targetCurrency = structured.currencyPair?.target ?? structured.destinationCurrency ?? null;
  const hasCorridor = Boolean(origin || destination || structured.country);
  const hasCurrency = Boolean(sourceCurrency || targetCurrency);
  const hasRouteId = Boolean(structured.routeId);
  if (!hasCorridor && !hasCurrency && !hasRouteId) return { result: 'none' };

  if (origin && route.corridor.origin !== origin) {
    return { result: 'not_affected', reason: 'explicit_corridor_mismatch' };
  }
  if (destination && route.corridor.destination !== destination) {
    return { result: 'not_affected', reason: 'explicit_corridor_mismatch' };
  }
  if (
    structured.country &&
    route.corridor.origin !== structured.country &&
    route.corridor.destination !== structured.country
  ) {
    return { result: 'not_affected', reason: 'explicit_corridor_mismatch' };
  }
  if (sourceCurrency && route.currencyPair?.source !== sourceCurrency) {
    return { result: 'not_affected', reason: 'explicit_currency_mismatch' };
  }
  if (targetCurrency && route.currencyPair?.target !== targetCurrency) {
    return { result: 'not_affected', reason: 'explicit_currency_mismatch' };
  }
  if (structured.routeId && structured.routeId !== route.offeringId) {
    return { result: 'not_affected', reason: 'explicit_corridor_mismatch' };
  }

  return {
    result: 'affected',
    reason: structuredMatchReason(structured, hasCorridor && !hasCurrency ? 'corridor' : 'currency'),
  };
}

function incidentEvidence(
  incident: ProviderPaymentIncidentObservation
): Pick<
  IncidentImpactEvaluation,
  'incidentId' | 'title' | 'sourceUrl' | 'observedAt' | 'provenance' | 'routeRelevance'
> {
  return {
    incidentId: incident.value.incidentId,
    title: incident.value.title,
    sourceUrl: incident.sourceUrl,
    observedAt: incident.observedAt,
    provenance: incident.provenance,
    routeRelevance: incident.value.routeRelevance,
  };
}

export function evaluateIncidentImpact(
  route: RouteImpactSubject,
  incident: ProviderPaymentIncidentObservation,
  now: Date = new Date()
): IncidentImpactEvaluation {
  const evidence = incidentEvidence(incident);
  if (!isObservationFresh(incident, now)) {
    return {
      observationType: 'provider_payment_incident',
      ...evidence,
      status: 'unknown',
      reason: 'stale_observation',
      freshness: 'stale',
    };
  }

  if (incident.providerId !== route.providerId) {
    return {
      observationType: 'provider_payment_incident',
      ...evidence,
      status: 'not_affected',
      reason: 'provider_mismatch',
      freshness: 'fresh',
    };
  }

  const hasPayments = incidentAffectsComponent(incident, WISE_PAYMENTS_COMPONENT_ID);
  const hasApi = incidentAffectsComponent(incident, WISE_API_COMPONENT_ID);
  const hasWebsite = incidentAffectsComponent(incident, WISE_WEBSITE_COMPONENT_ID);

  if (!hasPayments) {
    if (hasApi) {
      return {
        observationType: 'provider_payment_incident',
        ...evidence,
        status: 'unknown',
        reason: 'unknown_component_dependency',
        freshness: 'fresh',
      };
    }
    if (hasWebsite || incident.value.affectedComponentIds.length > 0) {
      return {
        observationType: 'provider_payment_incident',
        ...evidence,
        status: 'not_affected',
        reason: 'non_payment_component',
        freshness: 'fresh',
      };
    }
    return {
      observationType: 'provider_payment_incident',
      ...evidence,
      status: 'unknown',
      reason: 'insufficient_evidence',
      freshness: 'fresh',
    };
  }

  const matched = matchStructuredRoute(route, incident.value.structuredRoute);
  if (matched.result === 'none') {
    return {
      observationType: 'provider_payment_incident',
      ...evidence,
      status: 'unknown',
      reason: 'no_structured_match',
      freshness: 'fresh',
    };
  }

  return {
    observationType: 'provider_payment_incident',
    ...evidence,
    status: matched.result,
    reason: matched.reason ?? 'explicit_component_match',
    freshness: 'fresh',
  };
}

export function combineRouteImpact(
  health: HealthImpactEvaluation,
  incidents: readonly IncidentImpactEvaluation[]
): { overallImpact: RouteImpactStatus; overallReasons: RouteImpactReason[] } {
  const parts = [health, ...incidents];
  const reasons = parts.map((part) => part.reason);
  if (parts.some((part) => part.status === 'affected')) {
    return { overallImpact: 'affected', overallReasons: reasons };
  }
  if (parts.some((part) => part.status === 'unknown')) {
    return { overallImpact: 'unknown', overallReasons: reasons };
  }
  return { overallImpact: 'not_affected', overallReasons: reasons };
}

export function evaluateRouteImpact(
  route: RouteImpactSubject,
  input: {
    health?: LatestObservationRead | ProviderOperationalHealthObservation | null;
    incidents?: readonly ProviderPaymentIncidentObservation[];
    now?: Date;
  } = {}
): RouteImpactEvaluation {
  const now = input.now ?? new Date();
  const operationalHealth = evaluateOperationalHealthImpact(route, input.health, now);
  const incidents = (input.incidents ?? []).map((incident) =>
    evaluateIncidentImpact(route, incident, now)
  );
  const overall = combineRouteImpact(operationalHealth, incidents);
  return {
    mode: 'shadow',
    offeringId: route.offeringId,
    providerId: route.providerId,
    corridor: route.corridor,
    currencyPair: route.currencyPair,
    operationalHealth,
    incidents,
    ...overall,
  };
}

export function evaluateRouteImpacts(
  routes: readonly RouteImpactSubject[],
  input: {
    health?: LatestObservationRead | ProviderOperationalHealthObservation | null;
    incidents?: readonly ProviderPaymentIncidentObservation[];
    now?: Date;
  } = {}
): RouteImpactEvaluation[] {
  return routes.map((route) => evaluateRouteImpact(route, input));
}
