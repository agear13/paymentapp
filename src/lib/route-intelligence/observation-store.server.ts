import type { PrismaClient } from '@prisma/client';
import {
  evaluateLatestObservation,
  sameMeaningfulFeeState,
  sameMeaningfulHealthState,
  sameMeaningfulIncidentState,
  WISE_INCIDENT_SUBJECT_PREFIX,
  WISE_PAYMENTS_SUBJECT_ID,
} from '@/lib/route-intelligence/observation';
import {
  REGULATORY_STORE_PROVIDER_ID,
  sameMeaningfulRegulatoryState,
} from '@/lib/route-intelligence/regulatory-observation';
import type {
  LatestObservationRead,
  ProviderFeeObservation,
  ProviderOperationalHealthObservation,
  ProviderPaymentIncidentObservation,
  RailRegulatoryObservation,
} from '@/lib/route-intelligence/types';

export type StoredObservationRow = {
  id: string;
  observationType: string;
  subjectKind: string;
  subjectId: string;
  providerId: string;
  value: unknown;
  observedAt: Date;
  fetchedAt: Date;
  sourceId: string;
  sourceUrl: string;
  provenance: string;
  confidence: string;
  staleAfter: Date;
  rawHash: string;
  rawPayload: unknown;
  createdAt: Date;
};

export type ObservationRepository = {
  findLatestBySubject(subjectId: string): Promise<StoredObservationRow | null>;
  listByType(observationType: string): Promise<StoredObservationRow[]>;
  insert(row: Omit<StoredObservationRow, 'id' | 'createdAt'>): Promise<StoredObservationRow>;
  updateFetchTimestamps(id: string, fetchedAt: Date, staleAfter: Date): Promise<void>;
};

export type PersistObservationResult<T> =
  | { action: 'inserted'; observation: T; id: string }
  | { action: 'refreshed'; observation: T; id: string };

function sharedFields(row: StoredObservationRow) {
  return {
    subjectKind: row.subjectKind,
    subjectId: row.subjectId,
    providerId: row.providerId,
    observedAt: row.observedAt.toISOString(),
    fetchedAt: row.fetchedAt.toISOString(),
    sourceId: row.sourceId,
    sourceUrl: row.sourceUrl,
    provenance: 'externally_sourced' as const,
    confidence: 'high' as const,
    staleAfter: row.staleAfter.toISOString(),
    rawHash: row.rawHash,
  };
}

function rowToHealthObservation(row: StoredObservationRow): ProviderOperationalHealthObservation {
  return {
    observationType: 'provider_operational_health',
    ...sharedFields(row),
    subjectKind: 'provider_component',
    providerId: row.providerId as ProviderOperationalHealthObservation['providerId'],
    value: row.value as ProviderOperationalHealthObservation['value'],
    rawEvidence: row.rawPayload as ProviderOperationalHealthObservation['rawEvidence'],
  };
}

function rowToFeeObservation(row: StoredObservationRow): ProviderFeeObservation {
  return {
    observationType: 'provider_fee_observation',
    ...sharedFields(row),
    subjectKind: 'route',
    providerId: row.providerId as ProviderFeeObservation['providerId'],
    value: row.value as ProviderFeeObservation['value'],
    rawEvidence: row.rawPayload as ProviderFeeObservation['rawEvidence'],
  };
}

function rowToIncidentObservation(row: StoredObservationRow): ProviderPaymentIncidentObservation {
  return {
    observationType: 'provider_payment_incident',
    ...sharedFields(row),
    subjectKind: 'provider_incident',
    providerId: row.providerId as ProviderPaymentIncidentObservation['providerId'],
    value: row.value as ProviderPaymentIncidentObservation['value'],
    rawEvidence: row.rawPayload as ProviderPaymentIncidentObservation['rawEvidence'],
  };
}

function rowToRegulatoryObservation(row: StoredObservationRow): RailRegulatoryObservation {
  return {
    observationType: 'rail_regulatory_observation',
    subjectKind: 'rail',
    subjectId: row.subjectId,
    providerId: null,
    value: row.value as RailRegulatoryObservation['value'],
    observedAt: row.observedAt.toISOString(),
    fetchedAt: row.fetchedAt.toISOString(),
    sourceId: row.sourceId,
    sourceUrl: row.sourceUrl,
    provenance: row.provenance === 'curated' ? 'curated' : 'externally_sourced',
    confidence: row.confidence === 'unavailable' ? 'unavailable' : 'high',
    staleAfter: row.staleAfter.toISOString(),
    rawHash: row.rawHash,
    rawEvidence: row.rawPayload as RailRegulatoryObservation['rawEvidence'],
  };
}

export function toInsertRow(
  observation:
    | ProviderOperationalHealthObservation
    | ProviderPaymentIncidentObservation
    | ProviderFeeObservation
    | RailRegulatoryObservation
): Omit<StoredObservationRow, 'id' | 'createdAt'> {
  return {
    observationType: observation.observationType,
    subjectKind: observation.subjectKind,
    subjectId: observation.subjectId,
    providerId: observation.providerId ?? REGULATORY_STORE_PROVIDER_ID,
    value: observation.value,
    observedAt: new Date(observation.observedAt),
    fetchedAt: new Date(observation.fetchedAt),
    sourceId: observation.sourceId,
    sourceUrl: observation.sourceUrl,
    provenance: observation.provenance,
    confidence: observation.confidence,
    staleAfter: new Date(observation.staleAfter),
    rawHash: observation.rawHash,
    rawPayload: observation.rawEvidence,
  };
}

export async function persistOperationalHealthObservation(
  repository: ObservationRepository,
  observation: ProviderOperationalHealthObservation
): Promise<PersistObservationResult<ProviderOperationalHealthObservation>> {
  const previous = await repository.findLatestBySubject(observation.subjectId);
  if (
    previous?.observationType === 'provider_operational_health' &&
    sameMeaningfulHealthState(observation, rowToHealthObservation(previous))
  ) {
    await repository.updateFetchTimestamps(
      previous.id,
      new Date(observation.fetchedAt),
      new Date(observation.staleAfter)
    );
    return {
      action: 'refreshed',
      id: previous.id,
      observation: {
        ...rowToHealthObservation(previous),
        fetchedAt: observation.fetchedAt,
        staleAfter: observation.staleAfter,
      },
    };
  }

  const inserted = await repository.insert(toInsertRow(observation));
  return { action: 'inserted', id: inserted.id, observation };
}

export async function persistPaymentIncidentObservation(
  repository: ObservationRepository,
  observation: ProviderPaymentIncidentObservation
): Promise<PersistObservationResult<ProviderPaymentIncidentObservation>> {
  const previous = await repository.findLatestBySubject(observation.subjectId);
  if (
    previous?.observationType === 'provider_payment_incident' &&
    sameMeaningfulIncidentState(observation, rowToIncidentObservation(previous))
  ) {
    await repository.updateFetchTimestamps(
      previous.id,
      new Date(observation.fetchedAt),
      new Date(observation.staleAfter)
    );
    return {
      action: 'refreshed',
      id: previous.id,
      observation: {
        ...rowToIncidentObservation(previous),
        fetchedAt: observation.fetchedAt,
        staleAfter: observation.staleAfter,
      },
    };
  }

  const inserted = await repository.insert(toInsertRow(observation));
  return { action: 'inserted', id: inserted.id, observation };
}

export async function persistRailRegulatoryObservation(
  repository: ObservationRepository,
  observation: RailRegulatoryObservation
): Promise<PersistObservationResult<RailRegulatoryObservation>> {
  const previous = await repository.findLatestBySubject(observation.subjectId);
  if (
    previous?.observationType === 'rail_regulatory_observation' &&
    sameMeaningfulRegulatoryState(observation, rowToRegulatoryObservation(previous))
  ) {
    await repository.updateFetchTimestamps(
      previous.id,
      new Date(observation.fetchedAt),
      new Date(observation.staleAfter)
    );
    return {
      action: 'refreshed',
      id: previous.id,
      observation: {
        ...rowToRegulatoryObservation(previous),
        fetchedAt: observation.fetchedAt,
        staleAfter: observation.staleAfter,
      },
    };
  }

  const inserted = await repository.insert(toInsertRow(observation));
  return { action: 'inserted', id: inserted.id, observation };
}

export async function listRailRegulatoryObservations(
  repository: ObservationRepository
): Promise<RailRegulatoryObservation[]> {
  const rows = await repository.listByType('rail_regulatory_observation');
  return rows.map(rowToRegulatoryObservation);
}

export async function persistProviderFeeObservation(
  repository: ObservationRepository,
  observation: ProviderFeeObservation
): Promise<PersistObservationResult<ProviderFeeObservation>> {
  const previous = await repository.findLatestBySubject(observation.subjectId);
  if (
    previous?.observationType === 'provider_fee_observation' &&
    sameMeaningfulFeeState(observation, rowToFeeObservation(previous))
  ) {
    await repository.updateFetchTimestamps(
      previous.id,
      new Date(observation.fetchedAt),
      new Date(observation.staleAfter)
    );
    return {
      action: 'refreshed',
      id: previous.id,
      observation: {
        ...rowToFeeObservation(previous),
        fetchedAt: observation.fetchedAt,
        staleAfter: observation.staleAfter,
      },
    };
  }

  const inserted = await repository.insert(toInsertRow(observation));
  return { action: 'inserted', id: inserted.id, observation };
}

export async function listProviderFeeObservations(
  repository: ObservationRepository
): Promise<ProviderFeeObservation[]> {
  const rows = await repository.listByType('provider_fee_observation');
  return rows.map(rowToFeeObservation);
}

export async function listProviderFeeHistory(
  repository: ObservationRepository,
  subjectId: string
): Promise<ProviderFeeObservation[]> {
  return (await repository.listByType('provider_fee_observation'))
    .filter((row) => row.subjectId === subjectId)
    .sort((a, b) => a.fetchedAt.getTime() - b.fetchedAt.getTime())
    .map(rowToFeeObservation);
}

export async function getLatestWisePaymentsObservation(
  repository: ObservationRepository,
  now: Date = new Date()
): Promise<LatestObservationRead> {
  const row = await repository.findLatestBySubject(WISE_PAYMENTS_SUBJECT_ID);
  if (!row) {
    return { kind: 'unavailable', reason: 'missing' };
  }
  return evaluateLatestObservation(rowToHealthObservation(row), now);
}

export async function getLatestWiseIncidentObservations(
  repository: ObservationRepository
): Promise<ProviderPaymentIncidentObservation[]> {
  const rows = await repository.listByType('provider_payment_incident');
  const latestBySubject = new Map<string, StoredObservationRow>();
  for (const row of rows) {
    if (!row.subjectId.startsWith(WISE_INCIDENT_SUBJECT_PREFIX)) continue;
    const existing = latestBySubject.get(row.subjectId);
    if (!existing || row.fetchedAt > existing.fetchedAt) {
      latestBySubject.set(row.subjectId, row);
    }
  }
  return [...latestBySubject.values()].map(rowToIncidentObservation);
}

export async function listWiseIncidentHistory(
  repository: ObservationRepository,
  incidentId: string
): Promise<ProviderPaymentIncidentObservation[]> {
  const subjectId = `${WISE_INCIDENT_SUBJECT_PREFIX}${incidentId}`;
  const rows = (await repository.listByType('provider_payment_incident'))
    .filter((row) => row.subjectId === subjectId)
    .sort((a, b) => a.fetchedAt.getTime() - b.fetchedAt.getTime());
  return rows.map(rowToIncidentObservation);
}

export function createPrismaObservationRepository(
  prisma: Pick<PrismaClient, 'route_intelligence_observation'>
): ObservationRepository {
  return {
    async findLatestBySubject(subjectId) {
      const row = await prisma.route_intelligence_observation.findFirst({
        where: { subject_id: subjectId },
        orderBy: { fetched_at: 'desc' },
      });
      return row ? mapPrismaRow(row) : null;
    },
    async listByType(observationType) {
      const rows = await prisma.route_intelligence_observation.findMany({
        where: { observation_type: observationType },
        orderBy: { fetched_at: 'desc' },
      });
      return rows.map(mapPrismaRow);
    },
    async insert(input) {
      const row = await prisma.route_intelligence_observation.create({
        data: {
          observation_type: input.observationType,
          subject_kind: input.subjectKind,
          subject_id: input.subjectId,
          provider_id: input.providerId,
          value: input.value as object,
          observed_at: input.observedAt,
          fetched_at: input.fetchedAt,
          source_id: input.sourceId,
          source_url: input.sourceUrl,
          provenance: input.provenance,
          confidence: input.confidence,
          stale_after: input.staleAfter,
          raw_hash: input.rawHash,
          raw_payload: input.rawPayload as object,
        },
      });
      return mapPrismaRow(row);
    },
    async updateFetchTimestamps(id, fetchedAt, staleAfter) {
      await prisma.route_intelligence_observation.update({
        where: { id },
        data: { fetched_at: fetchedAt, stale_after: staleAfter },
      });
    },
  };
}

function mapPrismaRow(row: {
  id: string;
  observation_type: string;
  subject_kind: string;
  subject_id: string;
  provider_id: string;
  value: unknown;
  observed_at: Date;
  fetched_at: Date;
  source_id: string;
  source_url: string;
  provenance: string;
  confidence: string;
  stale_after: Date;
  raw_hash: string;
  raw_payload: unknown;
  created_at: Date;
}): StoredObservationRow {
  return {
    id: row.id,
    observationType: row.observation_type,
    subjectKind: row.subject_kind,
    subjectId: row.subject_id,
    providerId: row.provider_id,
    value: row.value,
    observedAt: row.observed_at,
    fetchedAt: row.fetched_at,
    sourceId: row.source_id,
    sourceUrl: row.source_url,
    provenance: row.provenance,
    confidence: row.confidence,
    staleAfter: row.stale_after,
    rawHash: row.raw_hash,
    rawPayload: row.raw_payload,
    createdAt: row.created_at,
  };
}
