import { OBSERVATION_FRESHNESS_MS } from '@/lib/route-intelligence/observation';
import type { LatestObservationRead, ProviderPaymentIncidentObservation } from '@/lib/route-intelligence/types';
import type { AdvisorMonitoringIncident, AdvisorMonitoringSnapshot } from '@/lib/advisor/payment-advisor-types';

const MAX_AGE_HOURS = OBSERVATION_FRESHNESS_MS / (60 * 60 * 1000);

function mapIncident(incident: ProviderPaymentIncidentObservation): AdvisorMonitoringIncident {
  return {
    incidentId: incident.value.incidentId,
    title: incident.value.title,
    status: incident.value.status,
    impact: incident.value.impact,
    description: incident.value.description,
    updatedAt: incident.value.updatedAt,
    sourceId: incident.sourceId,
    sourceUrl: incident.sourceUrl,
  };
}

export function buildAdvisorMonitoringSnapshot(input: {
  health: LatestObservationRead | undefined;
  paymentIncidents: readonly ProviderPaymentIncidentObservation[];
  otherIncidents: readonly ProviderPaymentIncidentObservation[];
}): AdvisorMonitoringSnapshot {
  const { health, paymentIncidents, otherIncidents } = input;

  if (!health || health.kind === 'unavailable') {
    return {
      providerId: 'wise',
      componentName: 'Payments',
      status: 'unavailable',
      componentStatus: null,
      pageDescription: null,
      observedAt: null,
      fetchedAt: null,
      staleAfter: null,
      freshness: {
        label: 'No Wise Payments observation loaded',
        maxAgeHours: MAX_AGE_HOURS,
        isStale: true,
      },
      source: null,
      activePaymentIncidents: paymentIncidents.map(mapIncident),
      otherIncidents: otherIncidents.map(mapIncident),
    };
  }

  const observation = health.observation;
  const isStale = health.kind === 'stale';

  return {
    providerId: 'wise',
    componentName: observation.value.componentName,
    status: health.kind,
    componentStatus: observation.value.componentStatus,
    pageDescription: observation.value.pageDescription,
    observedAt: observation.observedAt,
    fetchedAt: observation.fetchedAt,
    staleAfter: observation.staleAfter,
    freshness: {
      label: isStale
        ? `Observation stale (older than ${MAX_AGE_HOURS}h freshness window)`
        : `Observation within ${MAX_AGE_HOURS}h freshness window — not real-time`,
      maxAgeHours: MAX_AGE_HOURS,
      isStale,
    },
    source: {
      id: observation.sourceId,
      url: observation.sourceUrl,
    },
    activePaymentIncidents: paymentIncidents.map(mapIncident),
    otherIncidents: otherIncidents.map(mapIncident),
  };
}

export function formatMonitoringAnswer(monitoring: AdvisorMonitoringSnapshot): string[] {
  if (monitoring.status === 'unavailable') {
    return [
      'Wise Payments monitoring: unavailable.',
      monitoring.freshness.label,
      'Route rankings still use the curated catalogue until a Wise Statuspage observation is loaded.',
    ];
  }

  return [
    `Wise Payments monitoring: ${monitoring.componentStatus?.replace(/_/g, ' ') ?? 'unknown'}.`,
    monitoring.pageDescription ?? '',
    `Observed ${monitoring.observedAt}, fetched ${monitoring.fetchedAt}.`,
    monitoring.freshness.label,
    monitoring.source ? `Source: ${monitoring.source.id} (${monitoring.source.url})` : '',
  ].filter(Boolean);
}
