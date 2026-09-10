import {
  incidentAffectsComponent,
  isActiveIncidentStatus,
  WISE_PAYMENTS_COMPONENT_ID,
} from '@/lib/route-intelligence/observation';
import {
  evaluateIncidentImpact,
  evaluateOperationalHealthImpact,
  evaluateRouteImpact,
} from '@/lib/route-intelligence/route-impact';
import type {
  LatestObservationRead,
  ProviderOperationalHealthObservation,
  ProviderPaymentIncidentObservation,
  RouteEligibilityDecision,
  RouteEligibilityReason,
  RouteImpactSubject,
  StatuspageComponentStatus,
  StatuspageIncidentImpact,
} from '@/lib/route-intelligence/types';

const MATERIAL_INCIDENT_IMPACTS = new Set<StatuspageIncidentImpact>(['major', 'critical']);

function healthObservation(
  health: LatestObservationRead | ProviderOperationalHealthObservation | null | undefined
): ProviderOperationalHealthObservation | null {
  if (!health) return null;
  if ('kind' in health) {
    return health.kind === 'unavailable' ? null : health.observation;
  }
  return health;
}

function isTrustedObservation(observation: {
  provenance: string;
  confidence: string;
}): boolean {
  return observation.provenance === 'externally_sourced' && observation.confidence === 'high';
}

function healthFailureReason(
  status: StatuspageComponentStatus
): Extract<RouteEligibilityReason, 'provider_major_outage' | 'provider_partial_outage'> | null {
  if (status === 'major_outage') return 'provider_major_outage';
  if (status === 'partial_outage') return 'provider_partial_outage';
  return null;
}

/**
 * Production operational gate. Does not rank, price, or infer corridors from prose.
 *
 * ineligible = fresh, trusted, payment-infrastructure evidence of a material failure
 * unknown = intelligence exists but is not current enough to determine
 * eligible = no authorised exclusion applies (including missing evidence)
 *
 * `unknown` must never be treated as ineligible.
 */
export function evaluateRouteEligibility(
  route: RouteImpactSubject,
  input: {
    health?: LatestObservationRead | ProviderOperationalHealthObservation | null;
    incidents?: readonly ProviderPaymentIncidentObservation[];
    now?: Date;
  } = {}
): RouteEligibilityDecision {
  const now = input.now ?? new Date();
  const impact = evaluateRouteImpact(route, input);
  const evidence = [impact.operationalHealth, ...impact.incidents];
  const exclusionReasons: RouteEligibilityReason[] = [];

  const observation = healthObservation(input.health);
  const healthEval = evaluateOperationalHealthImpact(route, input.health, now);

  if (
    observation &&
    healthEval.freshness === 'fresh' &&
    isTrustedObservation(observation) &&
    observation.providerId === route.providerId &&
    observation.value.componentId === WISE_PAYMENTS_COMPONENT_ID
  ) {
    const reason = healthFailureReason(observation.value.componentStatus);
    if (reason) exclusionReasons.push(reason);
  }

  for (const incident of input.incidents ?? []) {
    const incidentEval = evaluateIncidentImpact(route, incident, now);
    if (
      incidentEval.freshness === 'fresh' &&
      incidentEval.status === 'affected' &&
      isTrustedObservation(incident) &&
      incident.providerId === route.providerId &&
      incidentAffectsComponent(incident, WISE_PAYMENTS_COMPONENT_ID) &&
      isActiveIncidentStatus(incident.value.status) &&
      MATERIAL_INCIDENT_IMPACTS.has(incident.value.impact)
    ) {
      exclusionReasons.push('structured_route_incident');
    }
  }

  if (exclusionReasons.length > 0) {
    return {
      offeringId: route.offeringId,
      providerId: route.providerId,
      status: 'ineligible',
      reasons: exclusionReasons,
      evidence,
    };
  }

  if (healthEval.freshness === 'stale') {
    return {
      offeringId: route.offeringId,
      providerId: route.providerId,
      status: 'unknown',
      reasons: ['stale_observation'],
      evidence,
    };
  }

  if (healthEval.freshness === 'missing' && (input.incidents?.length ?? 0) === 0) {
    return {
      offeringId: route.offeringId,
      providerId: route.providerId,
      status: 'eligible',
      reasons: ['missing_observation'],
      evidence,
    };
  }

  if (
    healthEval.freshness === 'fresh' &&
    healthEval.reason === 'provider_operational_health' &&
    healthEval.componentStatus === 'degraded_performance'
  ) {
    return {
      offeringId: route.offeringId,
      providerId: route.providerId,
      status: 'eligible',
      reasons: ['degraded_performance_not_excluded'],
      evidence,
    };
  }

  if (healthEval.reason === 'provider_mismatch') {
    return {
      offeringId: route.offeringId,
      providerId: route.providerId,
      status: 'eligible',
      reasons: ['provider_mismatch'],
      evidence,
    };
  }

  return {
    offeringId: route.offeringId,
    providerId: route.providerId,
    status: 'eligible',
    reasons: ['no_material_failure'],
    evidence,
  };
}

export function evaluateRouteEligibilities(
  routes: readonly RouteImpactSubject[],
  input: {
    health?: LatestObservationRead | ProviderOperationalHealthObservation | null;
    incidents?: readonly ProviderPaymentIncidentObservation[];
    now?: Date;
  } = {}
): RouteEligibilityDecision[] {
  return routes.map((route) => evaluateRouteEligibility(route, input));
}

/** Boolean compatibility for the existing candidate filter. Unknown is not excluded. */
export function routeIsNotExcluded(decision: RouteEligibilityDecision): boolean {
  return decision.status !== 'ineligible';
}
