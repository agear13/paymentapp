import { corridorTouchesJurisdiction, normalizeJurisdiction } from '@/lib/route-intelligence/corridor-kind';
import { isUnknownNetworkRail } from '@/lib/route-intelligence/network-rail';
import { isObservationFresh } from '@/lib/route-intelligence/observation';
import type {
  RailRegulatoryObservation,
  RegulatoryEvaluationContext,
  RegulatoryImpactEvaluation,
  RegulatoryStatus,
  RouteImpactReason,
  RouteImpactStatus,
  RouteSubject,
} from '@/lib/route-intelligence/types';

function normalizeToken(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function sameToken(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = normalizeToken(left);
  const b = normalizeToken(right);
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

function currencyTouches(
  route: RouteSubject,
  currency: string | null
): boolean {
  const target = normalizeToken(currency)?.toUpperCase();
  if (!target) return true;
  const source = normalizeToken(route.currencyPair.source)?.toUpperCase();
  const dest = normalizeToken(route.currencyPair.target)?.toUpperCase();
  return source === target || dest === target;
}

function inEffectiveWindow(
  observation: RailRegulatoryObservation,
  now: Date
): boolean {
  const from = observation.value.effectiveFrom;
  const to = observation.value.effectiveTo;
  if (from) {
    const start = new Date(from);
    if (!Number.isNaN(start.getTime()) && now.getTime() < start.getTime()) {
      return false;
    }
  }
  if (to) {
    const end = new Date(to);
    if (!Number.isNaN(end.getTime()) && now.getTime() > end.getTime()) {
      return false;
    }
  }
  return true;
}

function statusToImpact(status: RegulatoryStatus): {
  status: RouteImpactStatus;
  reason: RouteImpactReason;
} {
  if (status === 'prohibited') {
    return { status: 'affected', reason: 'regulatory_prohibited' };
  }
  if (status === 'restricted') {
    return { status: 'affected', reason: 'regulatory_restricted' };
  }
  if (status === 'permitted') {
    return { status: 'not_affected', reason: 'rail_match' };
  }
  return { status: 'unknown', reason: 'insufficient_evidence' };
}

function base(
  route: RouteSubject,
  observation: RailRegulatoryObservation | null,
  extras: Omit<
    RegulatoryImpactEvaluation,
    | 'mode'
    | 'observationType'
    | 'offeringId'
    | 'providerId'
    | 'corridor'
    | 'currencyPair'
    | 'networkRail'
    | 'observationSubjectId'
    | 'railId'
    | 'regulatoryStatus'
    | 'sourceUrl'
    | 'observedAt'
    | 'provenance'
  > &
    Partial<
      Pick<
        RegulatoryImpactEvaluation,
        | 'observationSubjectId'
        | 'railId'
        | 'regulatoryStatus'
        | 'sourceUrl'
        | 'observedAt'
        | 'provenance'
      >
    >
): RegulatoryImpactEvaluation {
  return {
    mode: 'shadow',
    observationType: 'rail_regulatory_observation',
    offeringId: route.offeringId,
    providerId: route.providerId,
    corridor: route.corridor,
    currencyPair: route.currencyPair,
    networkRail: route.networkRail,
    observationSubjectId: extras.observationSubjectId ?? observation?.subjectId ?? null,
    railId: extras.railId ?? observation?.value.railId ?? null,
    status: extras.status,
    reason: extras.reason,
    freshness: extras.freshness,
    regulatoryStatus: extras.regulatoryStatus ?? observation?.value.status ?? null,
    sourceUrl: extras.sourceUrl ?? observation?.sourceUrl ?? null,
    observedAt: extras.observedAt ?? observation?.observedAt ?? null,
    provenance: extras.provenance ?? observation?.provenance ?? null,
  };
}

/**
 * Shadow evaluation of structured regulatory state against a RouteSubject.
 * Does not change eligibility or ranking.
 * Stale evidence becomes unknown — never permitted or prohibited.
 */
export function evaluateRegulatoryRouteImpact(
  route: RouteSubject,
  observation: RailRegulatoryObservation | null | undefined,
  context: RegulatoryEvaluationContext = {}
): RegulatoryImpactEvaluation {
  const now = context.now ?? new Date();

  if (!observation) {
    return base(route, null, {
      status: 'unknown',
      reason: 'insufficient_evidence',
      freshness: 'missing',
      observationSubjectId: null,
      railId: null,
      regulatoryStatus: null,
      sourceUrl: null,
      observedAt: null,
      provenance: null,
    });
  }

  if (!isObservationFresh(observation, now)) {
    return base(route, observation, {
      status: 'unknown',
      reason: 'stale_observation',
      freshness: 'stale',
    });
  }

  const railId = normalizeToken(observation.value.railId);
  if (!railId || isUnknownNetworkRail(railId)) {
    return base(route, observation, {
      status: 'unknown',
      reason: 'insufficient_evidence',
      freshness: 'fresh',
    });
  }

  if (isUnknownNetworkRail(route.networkRail)) {
    return base(route, observation, {
      status: 'not_affected',
      reason: 'unknown_route_rail',
      freshness: 'fresh',
    });
  }

  if (route.networkRail !== railId) {
    return base(route, observation, {
      status: 'not_affected',
      reason: 'rail_mismatch',
      freshness: 'fresh',
    });
  }

  if (!corridorTouchesJurisdiction(route.corridor, observation.value.jurisdiction)) {
    return base(route, observation, {
      status: 'not_affected',
      reason: 'jurisdiction_mismatch',
      freshness: 'fresh',
    });
  }

  const obsPayment = normalizeToken(observation.value.paymentType);
  const ctxPayment = normalizeToken(context.paymentType);
  if (obsPayment && !ctxPayment) {
    return base(route, observation, {
      status: 'unknown',
      reason: 'insufficient_evidence',
      freshness: 'fresh',
    });
  }
  if (obsPayment && ctxPayment && !sameToken(obsPayment, ctxPayment)) {
    return base(route, observation, {
      status: 'not_affected',
      reason: 'payment_type_mismatch',
      freshness: 'fresh',
    });
  }

  const obsParticipant = normalizeToken(observation.value.participantType);
  const ctxParticipant = normalizeToken(context.participantType);
  if (obsParticipant && !ctxParticipant) {
    return base(route, observation, {
      status: 'unknown',
      reason: 'insufficient_evidence',
      freshness: 'fresh',
    });
  }
  if (obsParticipant && ctxParticipant && !sameToken(obsParticipant, ctxParticipant)) {
    return base(route, observation, {
      status: 'not_affected',
      reason: 'participant_type_mismatch',
      freshness: 'fresh',
    });
  }

  if (!currencyTouches(route, observation.value.currency)) {
    return base(route, observation, {
      status: 'not_affected',
      reason: 'currency_mismatch',
      freshness: 'fresh',
    });
  }

  if (!inEffectiveWindow(observation, now)) {
    return base(route, observation, {
      status: 'not_affected',
      reason: 'outside_effective_window',
      freshness: 'fresh',
    });
  }

  const impact = statusToImpact(observation.value.status);
  return base(route, observation, {
    ...impact,
    freshness: 'fresh',
  });
}

export function combineRegulatoryImpacts(
  evaluations: readonly RegulatoryImpactEvaluation[]
): { overallImpact: RouteImpactStatus; overallReasons: RouteImpactReason[] } {
  const reasons = evaluations.map((item) => item.reason);
  if (evaluations.some((item) => item.status === 'affected')) {
    return { overallImpact: 'affected', overallReasons: reasons };
  }
  if (evaluations.some((item) => item.status === 'unknown')) {
    return { overallImpact: 'unknown', overallReasons: reasons };
  }
  return { overallImpact: 'not_affected', overallReasons: reasons };
}

export function evaluateRegulatoryRouteImpacts(
  routes: readonly RouteSubject[],
  observations: readonly RailRegulatoryObservation[],
  context: RegulatoryEvaluationContext = {}
): RegulatoryImpactEvaluation[] {
  if (routes.length === 0) return [];
  if (observations.length === 0) {
    return routes.map((route) => evaluateRegulatoryRouteImpact(route, null, context));
  }
  return routes.flatMap((route) =>
    observations.map((observation) => evaluateRegulatoryRouteImpact(route, observation, context))
  );
}

export function normalizeJurisdictionCode(code: string | null | undefined) {
  return normalizeJurisdiction(code);
}
