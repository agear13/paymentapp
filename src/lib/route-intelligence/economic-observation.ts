import { observationStaleAfter } from '@/lib/route-intelligence/observation';
import { routeSubjectKey } from '@/lib/route-intelligence/route-subject';
import type {
  ProviderId,
  RouteAvailabilityObservation,
  RouteAvailabilityStatus,
  RouteFxObservation,
  RouteSettlementObservation,
  RouteSubject,
  SettlementBand,
  SettlementDurationUnit,
  FxRateKind,
} from '@/lib/route-intelligence/types';

export const FX_OBSERVATION_SUBJECT_PREFIX = 'route:fx:';
export const SETTLEMENT_OBSERVATION_SUBJECT_PREFIX = 'route:settlement:';
export const AVAILABILITY_OBSERVATION_SUBJECT_PREFIX = 'route:availability:';

function keyPart(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return 'none';
  const text = String(value).trim();
  return text || 'none';
}

export function fxObservationSubjectId(
  route: RouteSubject,
  sourceAmount: number | null,
  sourceCurrency: string | null,
  destinationCurrency: string | null
): string {
  return [
    FX_OBSERVATION_SUBJECT_PREFIX + routeSubjectKey(route),
    `amount:${keyPart(sourceAmount)}`,
    keyPart(sourceCurrency),
    keyPart(destinationCurrency),
  ].join(':');
}

export function settlementObservationSubjectId(route: RouteSubject): string {
  return `${SETTLEMENT_OBSERVATION_SUBJECT_PREFIX}${routeSubjectKey(route)}`;
}

export function availabilityObservationSubjectId(
  route: RouteSubject,
  paymentType: string | null
): string {
  return `${AVAILABILITY_OBSERVATION_SUBJECT_PREFIX}${routeSubjectKey(route)}:pt:${keyPart(paymentType)}`;
}

function sharedFields(input: {
  subjectId: string;
  providerId: ProviderId;
  observedAt: string;
  fetchedAt: string;
  sourceId: string;
  sourceUrl: string;
  provenance?: 'externally_sourced' | 'curated';
  rawHash: string;
}) {
  return {
    subjectKind: 'route' as const,
    subjectId: input.subjectId,
    providerId: input.providerId,
    observedAt: input.observedAt,
    fetchedAt: input.fetchedAt,
    sourceId: input.sourceId,
    sourceUrl: input.sourceUrl,
    provenance: input.provenance ?? 'externally_sourced',
    confidence: 'high' as const,
    staleAfter: observationStaleAfter(input.fetchedAt).toISOString(),
    rawHash: input.rawHash,
  };
}

export function buildRouteFxObservation(input: {
  route: RouteSubject;
  sourceCurrency: string | null;
  destinationCurrency: string | null;
  sourceAmount?: number | null;
  destinationAmount?: number | null;
  exchangeRate: number | null;
  rateKind: FxRateKind;
  rateSource: string;
  includesSpread?: boolean | null;
  observedAt: string;
  fetchedAt: string;
  sourceId: string;
  sourceUrl: string;
  provenance?: 'externally_sourced' | 'curated';
  rawHash: string;
}): RouteFxObservation {
  const sourceAmount = input.sourceAmount ?? null;
  const destinationAmount = input.destinationAmount ?? null;
  const includesSpread = input.includesSpread ?? null;
  const value: RouteFxObservation['value'] = {
    route: input.route,
    sourceCurrency: input.sourceCurrency,
    destinationCurrency: input.destinationCurrency,
    sourceAmount,
    destinationAmount,
    exchangeRate: input.exchangeRate,
    rateKind: input.rateKind,
    rateSource: input.rateSource,
    includesSpread,
  };
  return {
    observationType: 'route_fx_observation',
    ...sharedFields({
      subjectId: fxObservationSubjectId(
        input.route,
        sourceAmount,
        input.sourceCurrency,
        input.destinationCurrency
      ),
      providerId: input.route.providerId,
      observedAt: input.observedAt,
      fetchedAt: input.fetchedAt,
      sourceId: input.sourceId,
      sourceUrl: input.sourceUrl,
      provenance: input.provenance,
      rawHash: input.rawHash,
    }),
    value,
    rawEvidence: {
      routeKey: routeSubjectKey(input.route),
      sourceCurrency: input.sourceCurrency,
      destinationCurrency: input.destinationCurrency,
      sourceAmount,
      destinationAmount,
      exchangeRate: input.exchangeRate,
      rateKind: input.rateKind,
      rateSource: input.rateSource,
      includesSpread,
    },
  };
}

export function buildRouteSettlementObservation(input: {
  route: RouteSubject;
  band: SettlementBand;
  durationMin?: number | null;
  durationMax?: number | null;
  unit?: SettlementDurationUnit;
  settlementModel?: string | null;
  observedAt: string;
  fetchedAt: string;
  sourceId: string;
  sourceUrl: string;
  provenance?: 'externally_sourced' | 'curated';
  rawHash: string;
}): RouteSettlementObservation {
  const value: RouteSettlementObservation['value'] = {
    route: input.route,
    band: input.band,
    durationMin: input.durationMin ?? null,
    durationMax: input.durationMax ?? null,
    unit: input.unit ?? 'unknown',
    settlementModel: input.settlementModel ?? null,
  };
  return {
    observationType: 'route_settlement_observation',
    ...sharedFields({
      subjectId: settlementObservationSubjectId(input.route),
      providerId: input.route.providerId,
      observedAt: input.observedAt,
      fetchedAt: input.fetchedAt,
      sourceId: input.sourceId,
      sourceUrl: input.sourceUrl,
      provenance: input.provenance,
      rawHash: input.rawHash,
    }),
    value,
    rawEvidence: {
      routeKey: routeSubjectKey(input.route),
      band: value.band,
      durationMin: value.durationMin,
      durationMax: value.durationMax,
      unit: value.unit,
      settlementModel: value.settlementModel,
    },
  };
}

export function buildRouteAvailabilityObservation(input: {
  route: RouteSubject;
  status: RouteAvailabilityStatus;
  reason?: string | null;
  paymentType?: string | null;
  observedAt: string;
  fetchedAt: string;
  sourceId: string;
  sourceUrl: string;
  provenance?: 'externally_sourced' | 'curated';
  rawHash: string;
}): RouteAvailabilityObservation {
  const paymentType = input.paymentType ?? null;
  const value: RouteAvailabilityObservation['value'] = {
    route: input.route,
    status: input.status,
    reason: input.reason ?? null,
    paymentType,
  };
  return {
    observationType: 'route_availability_observation',
    ...sharedFields({
      subjectId: availabilityObservationSubjectId(input.route, paymentType),
      providerId: input.route.providerId,
      observedAt: input.observedAt,
      fetchedAt: input.fetchedAt,
      sourceId: input.sourceId,
      sourceUrl: input.sourceUrl,
      provenance: input.provenance,
      rawHash: input.rawHash,
    }),
    value,
    rawEvidence: {
      routeKey: routeSubjectKey(input.route),
      status: value.status,
      reason: value.reason,
      paymentType,
    },
  };
}

export function sameMeaningfulFxState(
  current: Pick<RouteFxObservation, 'value'>,
  previous: Pick<RouteFxObservation, 'value'>
): boolean {
  const a = current.value;
  const b = previous.value;
  return (
    a.exchangeRate === b.exchangeRate &&
    a.rateKind === b.rateKind &&
    a.sourceAmount === b.sourceAmount &&
    a.destinationAmount === b.destinationAmount &&
    a.sourceCurrency === b.sourceCurrency &&
    a.destinationCurrency === b.destinationCurrency &&
    a.includesSpread === b.includesSpread
  );
}

export function sameMeaningfulSettlementState(
  current: Pick<RouteSettlementObservation, 'value'>,
  previous: Pick<RouteSettlementObservation, 'value'>
): boolean {
  const a = current.value;
  const b = previous.value;
  return (
    a.band === b.band &&
    a.durationMin === b.durationMin &&
    a.durationMax === b.durationMax &&
    a.unit === b.unit &&
    a.settlementModel === b.settlementModel
  );
}

export function sameMeaningfulAvailabilityState(
  current: Pick<RouteAvailabilityObservation, 'value'>,
  previous: Pick<RouteAvailabilityObservation, 'value'>
): boolean {
  return (
    current.value.status === previous.value.status &&
    current.value.reason === previous.value.reason &&
    current.value.paymentType === previous.value.paymentType
  );
}

export function fxObservationAppliesToRoute(
  observation: RouteFxObservation,
  route: RouteSubject,
  amount?: number | null
): boolean {
  if (routeSubjectKey(observation.value.route) !== routeSubjectKey(route)) {
    return false;
  }
  if (observation.value.sourceAmount !== null) {
    return amount === observation.value.sourceAmount;
  }
  return true;
}

export function settlementObservationAppliesToRoute(
  observation: RouteSettlementObservation,
  route: RouteSubject
): boolean {
  return routeSubjectKey(observation.value.route) === routeSubjectKey(route);
}

export function availabilityObservationAppliesToRoute(
  observation: RouteAvailabilityObservation,
  route: RouteSubject,
  paymentType?: string | null
): boolean {
  if (routeSubjectKey(observation.value.route) !== routeSubjectKey(route)) {
    return false;
  }
  if (observation.value.paymentType) {
    return observation.value.paymentType === (paymentType ?? null);
  }
  return true;
}
