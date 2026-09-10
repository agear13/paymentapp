import { createHash } from 'crypto';
import {
  findStatuspageComponent,
  readStatuspageSummary,
} from '@/lib/route-intelligence/statuspage';
import {
  observationStaleAfter,
  wiseIncidentSubjectId,
  WISE_PAYMENTS_COMPONENT_ID,
  WISE_PAYMENTS_SUBJECT_ID,
} from '@/lib/route-intelligence/observation';
import type {
  ProviderId,
  ProviderOperationalHealthObservation,
  ProviderPaymentIncidentObservation,
} from '@/lib/route-intelligence/types';

/**
 * Official Wise Statuspage. Not the Wise Platform API host and not a payment-execution client.
 * Future AirwallexStatusAdapter should implement the same StatusAdapter contract.
 */
export const WISE_STATUS_SOURCE_ID = 'wise_statuspage';
export const WISE_STATUS_SUMMARY_URL = 'https://status.wise.com/api/v2/summary.json';
export const WISE_STATUS_HOST = 'status.wise.com';

export { WISE_PAYMENTS_COMPONENT_ID, WISE_PAYMENTS_SUBJECT_ID };

export const WISE_STATUS_FETCH_TIMEOUT_MS = 10_000;

export type StatusAdapterFailureReason =
  | 'http_failure'
  | 'malformed'
  | 'missing_payments_component';

export type StatusAdapterResult =
  | { ok: true; observation: ProviderOperationalHealthObservation }
  | { ok: false; reason: StatusAdapterFailureReason };

export type OfficialStatusAdapter = {
  sourceId: string;
  providerId: ProviderId;
  fetchPayload: (input?: { fetcher?: typeof fetch; timeoutMs?: number }) => Promise<unknown>;
  parseObservation: (payload: unknown, fetchedAt: Date) => StatusAdapterResult;
};

function isStatusWiseHost(url: string): boolean {
  try {
    return new URL(url).hostname === WISE_STATUS_HOST;
  } catch {
    return false;
  }
}

export async function fetchWiseStatusSummary(input?: {
  fetcher?: typeof fetch;
  timeoutMs?: number;
  url?: string;
}): Promise<{ ok: true; payload: unknown } | { ok: false; reason: 'http_failure' }> {
  const url = input?.url ?? WISE_STATUS_SUMMARY_URL;
  if (!isStatusWiseHost(url)) {
    return { ok: false, reason: 'http_failure' };
  }

  const fetcher = input?.fetcher ?? fetch;
  const timeoutMs = input?.timeoutMs ?? WISE_STATUS_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, reason: 'http_failure' };
    }
    const payload: unknown = await response.json();
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: 'http_failure' };
  } finally {
    clearTimeout(timer);
  }
}

export function parseWisePaymentsObservation(
  payload: unknown,
  fetchedAt: Date,
  sourceUrl: string = WISE_STATUS_SUMMARY_URL
): StatusAdapterResult {
  const summary = readStatuspageSummary(payload);
  if (!summary) {
    return { ok: false, reason: 'malformed' };
  }

  const payments = findStatuspageComponent(summary, WISE_PAYMENTS_COMPONENT_ID);
  if (!payments) {
    return { ok: false, reason: 'missing_payments_component' };
  }

  const observedAt = new Date(summary.pageUpdatedAt);
  if (Number.isNaN(observedAt.getTime())) {
    return { ok: false, reason: 'malformed' };
  }

  const rawEvidence = {
    pageUpdatedAt: summary.pageUpdatedAt,
    pageIndicator: summary.pageIndicator,
    pageDescription: summary.pageDescription,
    componentId: payments.id,
    componentName: payments.name,
    componentStatus: payments.status,
  };

  const observation: ProviderOperationalHealthObservation = {
    observationType: 'provider_operational_health',
    subjectKind: 'provider_component',
    subjectId: WISE_PAYMENTS_SUBJECT_ID,
    providerId: 'wise',
    value: {
      pageIndicator: summary.pageIndicator,
      pageDescription: summary.pageDescription,
      componentId: payments.id,
      componentName: payments.name,
      componentStatus: payments.status,
    },
    observedAt: observedAt.toISOString(),
    fetchedAt: fetchedAt.toISOString(),
    sourceId: WISE_STATUS_SOURCE_ID,
    sourceUrl,
    provenance: 'externally_sourced',
    confidence: 'high',
    staleAfter: observationStaleAfter(fetchedAt).toISOString(),
    rawHash: createHash('sha256').update(JSON.stringify(rawEvidence)).digest('hex'),
    rawEvidence,
  };

  return { ok: true, observation };
}

export const wiseStatusAdapter: OfficialStatusAdapter = {
  sourceId: WISE_STATUS_SOURCE_ID,
  providerId: 'wise',
  fetchPayload: async (input) => {
    const result = await fetchWiseStatusSummary(input);
    if (!result.ok) {
      throw new Error('Wise Statuspage fetch failed');
    }
    return result.payload;
  },
  parseObservation: parseWisePaymentsObservation,
};

export function parseWiseIncidentObservations(
  payload: unknown,
  fetchedAt: Date,
  sourceUrl: string = WISE_STATUS_SUMMARY_URL
): ProviderPaymentIncidentObservation[] {
  const summary = readStatuspageSummary(payload);
  if (!summary) return [];

  return summary.incidents.map((incident) => {
    const observedAt = new Date(incident.updatedAt);
    const rawEvidence = {
      incidentId: incident.id,
      status: incident.status,
      impact: incident.impact,
      title: incident.name,
      description: incident.latestUpdateBody,
      startedAt: new Date(incident.startedAt).toISOString(),
      updatedAt: observedAt.toISOString(),
      resolvedAt: incident.resolvedAt ? new Date(incident.resolvedAt).toISOString() : null,
      affectedComponentIds: incident.affectedComponentIds,
      affectedComponentNames: incident.affectedComponentNames,
      latestUpdateId: incident.latestUpdateId,
    };

    const observation: ProviderPaymentIncidentObservation = {
      observationType: 'provider_payment_incident',
      subjectKind: 'provider_incident',
      subjectId: wiseIncidentSubjectId(incident.id),
      providerId: 'wise',
      value: {
        incidentId: incident.id,
        status: incident.status,
        impact: incident.impact,
        title: incident.name,
        description: incident.latestUpdateBody,
        startedAt: rawEvidence.startedAt,
        updatedAt: rawEvidence.updatedAt,
        resolvedAt: rawEvidence.resolvedAt,
        affectedComponentIds: incident.affectedComponentIds,
        affectedComponentNames: incident.affectedComponentNames,
        latestUpdateId: incident.latestUpdateId,
        latestUpdateStatus: incident.latestUpdateStatus,
        routeRelevance: 'unknown',
        structuredRoute: null,
      },
      observedAt: observedAt.toISOString(),
      fetchedAt: fetchedAt.toISOString(),
      sourceId: WISE_STATUS_SOURCE_ID,
      sourceUrl: `https://status.wise.com/incidents/${incident.id}`,
      provenance: 'externally_sourced',
      confidence: 'high',
      staleAfter: observationStaleAfter(fetchedAt).toISOString(),
      rawHash: createHash('sha256').update(JSON.stringify(rawEvidence)).digest('hex'),
      rawEvidence,
    };
    return observation;
  });
}

export type WiseStatusObservationResult =
  | {
      ok: true;
      observation: ProviderOperationalHealthObservation;
      incidents: ProviderPaymentIncidentObservation[];
    }
  | { ok: false; reason: StatusAdapterFailureReason; incidents: ProviderPaymentIncidentObservation[] };

export async function observeWiseStatus(input?: {
  fetcher?: typeof fetch;
  timeoutMs?: number;
  fetchedAt?: Date;
}): Promise<WiseStatusObservationResult> {
  const fetchedAt = input?.fetchedAt ?? new Date();
  const fetched = await fetchWiseStatusSummary({
    fetcher: input?.fetcher,
    timeoutMs: input?.timeoutMs,
  });
  if (!fetched.ok) {
    return { ok: false, reason: fetched.reason, incidents: [] };
  }
  const health = parseWisePaymentsObservation(fetched.payload, fetchedAt);
  const incidents = parseWiseIncidentObservations(fetched.payload, fetchedAt);
  if (!health.ok) {
    return { ok: false, reason: health.reason, incidents };
  }
  return { ok: true, observation: health.observation, incidents };
}

export async function observeWisePaymentsHealth(input?: {
  fetcher?: typeof fetch;
  timeoutMs?: number;
  fetchedAt?: Date;
}): Promise<StatusAdapterResult> {
  const result = await observeWiseStatus(input);
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }
  return { ok: true, observation: result.observation };
}
