import { observationStaleAfter } from '@/lib/route-intelligence/observation';
import type {
  JurisdictionCode,
  NetworkRailId,
  RailRegulatoryObservation,
  RegulatoryStatus,
} from '@/lib/route-intelligence/types';

export const REGULATORY_OBSERVATION_SUBJECT_PREFIX = 'rail:reg:';

/** Sentinel stored in route_intelligence_observation.provider_id — not a payment provider. */
export const REGULATORY_STORE_PROVIDER_ID = 'none';

export const REGULATORY_STATUSES: readonly RegulatoryStatus[] = [
  'permitted',
  'restricted',
  'prohibited',
  'required',
  'changed',
  'unknown',
];

function keyPart(value: string | null | undefined): string {
  return value && value.trim() ? value.trim() : '-';
}

/**
 * Identity includes rail, jurisdiction, payment type, participant, currency,
 * and effective window so distinct facts do not overwrite each other.
 */
export function regulatoryObservationSubjectId(input: {
  railId: NetworkRailId;
  jurisdiction: JurisdictionCode | null;
  paymentType: string | null;
  participantType: string | null;
  currency: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}): string {
  return [
    REGULATORY_OBSERVATION_SUBJECT_PREFIX + keyPart(input.railId),
    `j:${keyPart(input.jurisdiction)}`,
    `pt:${keyPart(input.paymentType)}`,
    `part:${keyPart(input.participantType)}`,
    `ccy:${keyPart(input.currency)}`,
    `from:${keyPart(input.effectiveFrom)}`,
    `to:${keyPart(input.effectiveTo)}`,
  ].join('|');
}

export function sameMeaningfulRegulatoryState(
  current: Pick<RailRegulatoryObservation, 'value'>,
  previous: Pick<RailRegulatoryObservation, 'value'>
): boolean {
  const a = current.value;
  const b = previous.value;
  return (
    a.railId === b.railId &&
    a.jurisdiction === b.jurisdiction &&
    a.paymentType === b.paymentType &&
    a.currency === b.currency &&
    a.participantType === b.participantType &&
    a.status === b.status &&
    a.effectiveFrom === b.effectiveFrom &&
    a.effectiveTo === b.effectiveTo
  );
}

export function buildRailRegulatoryObservation(input: {
  railId: NetworkRailId;
  jurisdiction?: string | null;
  paymentType?: string | null;
  currency?: string | null;
  participantType?: string | null;
  status: RegulatoryStatus;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  observedAt: string;
  fetchedAt: string;
  sourceId: string;
  sourceUrl: string;
  source: string;
  provenance?: RailRegulatoryObservation['provenance'];
  confidence?: RailRegulatoryObservation['confidence'];
  rawHash: string;
}): RailRegulatoryObservation {
  const value: RailRegulatoryObservation['value'] = {
    railId: input.railId,
    jurisdiction: input.jurisdiction ?? null,
    paymentType: input.paymentType ?? null,
    currency: input.currency ?? null,
    participantType: input.participantType ?? null,
    status: input.status,
    effectiveFrom: input.effectiveFrom ?? null,
    effectiveTo: input.effectiveTo ?? null,
  };
  return {
    observationType: 'rail_regulatory_observation',
    subjectKind: 'rail',
    subjectId: regulatoryObservationSubjectId(value),
    providerId: null,
    value,
    observedAt: input.observedAt,
    fetchedAt: input.fetchedAt,
    sourceId: input.sourceId,
    sourceUrl: input.sourceUrl,
    provenance: input.provenance ?? 'externally_sourced',
    confidence: input.confidence ?? 'high',
    staleAfter: observationStaleAfter(input.fetchedAt).toISOString(),
    rawHash: input.rawHash,
    rawEvidence: {
      ...value,
      source: input.source,
    },
  };
}
