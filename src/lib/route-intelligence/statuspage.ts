import type {
  StatuspageComponentStatus,
  StatuspageIncidentImpact,
  StatuspageIncidentStatus,
  StatuspagePageIndicator,
} from '@/lib/route-intelligence/types';

export const STATUSPAGE_COMPONENT_STATUSES = [
  'operational',
  'degraded_performance',
  'partial_outage',
  'major_outage',
] as const satisfies readonly StatuspageComponentStatus[];

export const STATUSPAGE_PAGE_INDICATORS = [
  'none',
  'minor',
  'major',
  'critical',
] as const satisfies readonly StatuspagePageIndicator[];

export type StatuspageComponent = {
  id: string;
  name: string;
  status: StatuspageComponentStatus;
};

export const STATUSPAGE_INCIDENT_STATUSES = [
  'investigating',
  'identified',
  'monitoring',
  'resolved',
  'postmortem',
] as const satisfies readonly StatuspageIncidentStatus[];

export const STATUSPAGE_INCIDENT_IMPACTS = [
  'none',
  'minor',
  'major',
  'critical',
] as const satisfies readonly StatuspageIncidentImpact[];

export type StatuspageIncident = {
  id: string;
  name: string;
  status: StatuspageIncidentStatus;
  impact: StatuspageIncidentImpact;
  startedAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  shortlink: string | null;
  affectedComponentIds: string[];
  affectedComponentNames: string[];
  latestUpdateId: string | null;
  latestUpdateStatus: StatuspageIncidentStatus | null;
  latestUpdateBody: string;
};

export type StatuspageSummary = {
  pageUpdatedAt: string;
  pageIndicator: StatuspagePageIndicator;
  pageDescription: string;
  components: StatuspageComponent[];
  incidents: StatuspageIncident[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isStatuspageComponentStatus(
  value: unknown
): value is StatuspageComponentStatus {
  return (
    typeof value === 'string' &&
    (STATUSPAGE_COMPONENT_STATUSES as readonly string[]).includes(value)
  );
}

export function isStatuspagePageIndicator(value: unknown): value is StatuspagePageIndicator {
  return typeof value === 'string' && (STATUSPAGE_PAGE_INDICATORS as readonly string[]).includes(value);
}

export function isStatuspageIncidentStatus(value: unknown): value is StatuspageIncidentStatus {
  return typeof value === 'string' && (STATUSPAGE_INCIDENT_STATUSES as readonly string[]).includes(value);
}

export function isStatuspageIncidentImpact(value: unknown): value is StatuspageIncidentImpact {
  return typeof value === 'string' && (STATUSPAGE_INCIDENT_IMPACTS as readonly string[]).includes(value);
}

/**
 * Shared Statuspage JSON reader. Future official adapters (e.g. Airwallex) reuse this.
 * Returns null instead of guessing when the payload is malformed.
 */
export function readStatuspageSummary(payload: unknown): StatuspageSummary | null {
  if (!isRecord(payload)) return null;
  const page = payload.page;
  const status = payload.status;
  const components = payload.components;
  if (!isRecord(page) || !isRecord(status) || !Array.isArray(components)) return null;
  if (typeof page.updated_at !== 'string' || !page.updated_at.trim()) return null;
  if (!isStatuspagePageIndicator(status.indicator)) return null;
  if (typeof status.description !== 'string') return null;

  const mapped: StatuspageComponent[] = [];
  for (const item of components) {
    if (!isRecord(item)) return null;
    if (typeof item.id !== 'string' || !item.id.trim()) return null;
    if (typeof item.name !== 'string' || !item.name.trim()) return null;
    if (!isStatuspageComponentStatus(item.status)) return null;
    mapped.push({ id: item.id, name: item.name, status: item.status });
  }

  const incidents: StatuspageIncident[] = [];
  if (Array.isArray(payload.incidents)) {
    for (const item of payload.incidents) {
      const parsed = readStatuspageIncident(item);
      if (parsed) incidents.push(parsed);
    }
  }

  return {
    pageUpdatedAt: page.updated_at,
    pageIndicator: status.indicator,
    pageDescription: status.description,
    components: mapped,
    incidents,
  };
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()))];
}

function latestIncidentUpdate(updates: unknown): Record<string, unknown> | null {
  if (!Array.isArray(updates) || updates.length === 0) return null;
  const records = updates.filter(isRecord);
  if (records.length === 0) return null;
  return records.reduce((latest, item) => {
    const latestTime = typeof latest.created_at === 'string' ? Date.parse(latest.created_at) : 0;
    const itemTime = typeof item.created_at === 'string' ? Date.parse(item.created_at) : 0;
    return itemTime >= latestTime ? item : latest;
  });
}

function readAffectedComponents(source: unknown): { ids: string[]; names: string[] } {
  if (!Array.isArray(source)) return { ids: [], names: [] };
  const ids: string[] = [];
  const names: string[] = [];
  for (const item of source) {
    if (!isRecord(item)) continue;
    const id = typeof item.id === 'string' ? item.id : typeof item.code === 'string' ? item.code : '';
    const name = typeof item.name === 'string' ? item.name : '';
    if (id) ids.push(id);
    if (name) names.push(name);
  }
  return { ids: uniqueStrings(ids), names: uniqueStrings(names) };
}

export function readStatuspageIncident(payload: unknown): StatuspageIncident | null {
  if (!isRecord(payload)) return null;
  if (typeof payload.id !== 'string' || !payload.id.trim()) return null;
  if (typeof payload.name !== 'string' || !payload.name.trim()) return null;
  if (!isStatuspageIncidentStatus(payload.status)) return null;
  if (!isStatuspageIncidentImpact(payload.impact)) return null;
  const startedAt = typeof payload.started_at === 'string' ? payload.started_at : null;
  const updatedAt = typeof payload.updated_at === 'string' ? payload.updated_at : null;
  if (!startedAt || !updatedAt) return null;
  if (Number.isNaN(new Date(startedAt).getTime()) || Number.isNaN(new Date(updatedAt).getTime())) {
    return null;
  }
  const resolvedAt =
    typeof payload.resolved_at === 'string' && payload.resolved_at.trim()
      ? payload.resolved_at
      : null;
  if (resolvedAt && Number.isNaN(new Date(resolvedAt).getTime())) return null;

  const latestUpdate = latestIncidentUpdate(payload.incident_updates);
  const fromIncident = readAffectedComponents(payload.components);
  const fromUpdate = readAffectedComponents(latestUpdate?.affected_components);
  const affectedComponentIds = fromIncident.ids.length > 0 ? fromIncident.ids : fromUpdate.ids;
  const affectedComponentNames = fromIncident.names.length > 0 ? fromIncident.names : fromUpdate.names;

  return {
    id: payload.id,
    name: payload.name,
    status: payload.status,
    impact: payload.impact,
    startedAt,
    updatedAt,
    resolvedAt,
    shortlink: typeof payload.shortlink === 'string' ? payload.shortlink : null,
    affectedComponentIds,
    affectedComponentNames,
    latestUpdateId: typeof latestUpdate?.id === 'string' ? latestUpdate.id : null,
    latestUpdateStatus: isStatuspageIncidentStatus(latestUpdate?.status)
      ? latestUpdate.status
      : null,
    latestUpdateBody: typeof latestUpdate?.body === 'string' ? latestUpdate.body : '',
  };
}

export function findStatuspageComponent(
  summary: StatuspageSummary,
  componentId: string
): StatuspageComponent | null {
  return summary.components.find((item) => item.id === componentId) ?? null;
}
