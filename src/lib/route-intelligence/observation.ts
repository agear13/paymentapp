import type {
  AvailabilitySignal,
  LatestObservationRead,
  Offering,
  ObservedAvailabilitySignal,
  ProviderOperationalHealthObservation,
  ProviderPaymentIncidentObservation,
  StatuspageIncidentStatus,
  UnobservedAvailabilitySignal,
} from '@/lib/route-intelligence/types';

/** First implementation freshness window. Easy to change later. */
export const OBSERVATION_FRESHNESS_MS = 3 * 60 * 60 * 1000;

export const WISE_PAYMENTS_SUBJECT_ID = 'wise:payments';
export const WISE_PAYMENTS_COMPONENT_ID = '2jxb8y760wrd';
export const WISE_API_COMPONENT_ID = 'bmfb24t34ymm';
export const WISE_WEBSITE_COMPONENT_ID = 'blqbkggdgs46';

/** Wise catalogue offerings that represent sending/paying out money. */
export const WISE_PAYMENTS_OFFERING_IDS = ['wise-international', 'wise-local'] as const;

export function observationStaleAfter(fetchedAt: Date | string): Date {
  const fetched = typeof fetchedAt === 'string' ? new Date(fetchedAt) : fetchedAt;
  return new Date(fetched.getTime() + OBSERVATION_FRESHNESS_MS);
}

export function isObservationFresh(
  observation: Pick<ProviderOperationalHealthObservation, 'fetchedAt' | 'staleAfter'>,
  now: Date = new Date()
): boolean {
  const staleAfter = new Date(observation.staleAfter);
  if (Number.isNaN(staleAfter.getTime())) return false;
  return now.getTime() < staleAfter.getTime();
}

export const WISE_INCIDENT_SUBJECT_PREFIX = 'wise:incident:';

export const ACTIVE_INCIDENT_STATUSES: readonly StatuspageIncidentStatus[] = [
  'investigating',
  'identified',
  'monitoring',
];

export function wiseIncidentSubjectId(incidentId: string): string {
  return `${WISE_INCIDENT_SUBJECT_PREFIX}${incidentId}`;
}

export function assertExternallySourcedObservation(
  observation: Pick<
    ProviderOperationalHealthObservation | ProviderPaymentIncidentObservation,
    'provenance' | 'observedAt' | 'fetchedAt' | 'sourceId' | 'sourceUrl'
  >
): void {
  if (observation.provenance !== 'externally_sourced') {
    throw new Error('Operational health observation must be externally_sourced');
  }
  if (!observation.observedAt?.trim()) {
    throw new Error('externally_sourced observation requires observedAt');
  }
  if (!observation.fetchedAt?.trim()) {
    throw new Error('externally_sourced observation requires fetchedAt');
  }
  if (!observation.sourceId?.trim()) {
    throw new Error('externally_sourced observation requires sourceId');
  }
  if (!observation.sourceUrl?.trim()) {
    throw new Error('externally_sourced observation requires sourceUrl');
  }
  if (Number.isNaN(new Date(observation.observedAt).getTime())) {
    throw new Error('externally_sourced observation observedAt is not a valid timestamp');
  }
  if (Number.isNaN(new Date(observation.fetchedAt).getTime())) {
    throw new Error('externally_sourced observation fetchedAt is not a valid timestamp');
  }
}

export function evaluateLatestObservation(
  observation: ProviderOperationalHealthObservation | null,
  now: Date = new Date()
): LatestObservationRead {
  if (!observation) {
    return { kind: 'unavailable', reason: 'missing' };
  }
  try {
    assertExternallySourcedObservation(observation);
  } catch {
    return { kind: 'unavailable', reason: 'invalid' };
  }
  if (!isObservationFresh(observation, now)) {
    return { kind: 'stale', observation };
  }
  return { kind: 'current', observation };
}

export function meaningfulHealthState(
  observation: Pick<ProviderOperationalHealthObservation, 'value'>
): string {
  return `${observation.value.componentStatus}|${observation.value.pageIndicator}`;
}

export function sameMeaningfulHealthState(
  current: Pick<ProviderOperationalHealthObservation, 'value'>,
  previous: Pick<ProviderOperationalHealthObservation, 'value'>
): boolean {
  return meaningfulHealthState(current) === meaningfulHealthState(previous);
}

export function sameMeaningfulIncidentState(
  current: Pick<ProviderPaymentIncidentObservation, 'value'>,
  previous: Pick<ProviderPaymentIncidentObservation, 'value'>
): boolean {
  return (
    current.value.status === previous.value.status &&
    current.value.impact === previous.value.impact &&
    current.value.latestUpdateId === previous.value.latestUpdateId &&
    current.value.resolvedAt === previous.value.resolvedAt
  );
}

export function isActiveIncidentStatus(status: StatuspageIncidentStatus): boolean {
  return (ACTIVE_INCIDENT_STATUSES as readonly string[]).includes(status);
}

export function incidentAffectsComponent(
  observation: Pick<ProviderPaymentIncidentObservation, 'value'>,
  componentId: string
): boolean {
  return observation.value.affectedComponentIds.includes(componentId);
}

export function offeringReceivesWisePaymentsHealth(offering: Offering): boolean {
  return (
    offering.provider.id === 'wise' &&
    (WISE_PAYMENTS_OFFERING_IDS as readonly string[]).includes(offering.id)
  );
}

export function availabilityFromLatestRead(
  read: LatestObservationRead
): AvailabilitySignal {
  if (read.kind === 'current') {
    const observed: ObservedAvailabilitySignal = {
      provenance: 'externally_sourced',
      type: 'observed',
      observedAt: read.observation.observedAt,
      sourceUrl: read.observation.sourceUrl,
      componentStatus: read.observation.value.componentStatus,
      pageIndicator: read.observation.value.pageIndicator,
      freshness: 'current',
    };
    return observed;
  }
  const unobserved: UnobservedAvailabilitySignal = {
    provenance: 'unavailable',
    type: 'unobserved',
    observedAt: null,
    reason: read.kind === 'stale' ? 'stale' : read.reason,
  };
  return unobserved;
}

export function attachWisePaymentsAvailability(
  offerings: Offering[],
  read: LatestObservationRead | undefined
): Offering[] {
  if (!read) return offerings;
  const availability = availabilityFromLatestRead(read);
  return offerings.map((offering) =>
    offeringReceivesWisePaymentsHealth(offering) ? { ...offering, availability } : offering
  );
}

export function attachedObservations(
  read: LatestObservationRead | undefined
): ProviderOperationalHealthObservation[] {
  if (!read || read.kind === 'unavailable') return [];
  return [read.observation];
}

export function partitionActiveIncidents(
  incidents: readonly ProviderPaymentIncidentObservation[],
  paymentsComponentId: string,
  now: Date = new Date()
): {
  paymentIncidents: ProviderPaymentIncidentObservation[];
  otherIncidents: ProviderPaymentIncidentObservation[];
} {
  const paymentIncidents: ProviderPaymentIncidentObservation[] = [];
  const otherIncidents: ProviderPaymentIncidentObservation[] = [];
  for (const incident of incidents) {
    try {
      assertExternallySourcedObservation(incident);
    } catch {
      continue;
    }
    if (!isObservationFresh(incident, now)) continue;
    if (!isActiveIncidentStatus(incident.value.status)) continue;
    if (incidentAffectsComponent(incident, paymentsComponentId)) {
      paymentIncidents.push(incident);
    } else {
      otherIncidents.push(incident);
    }
  }
  return { paymentIncidents, otherIncidents };
}
