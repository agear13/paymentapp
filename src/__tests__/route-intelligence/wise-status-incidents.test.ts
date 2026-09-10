import { compareLandingRoutes, DEFAULT_LANDING_SEARCH, rankLandingRoutes } from '@/lib/journey/landing-route-comparison';
import {
  CORRIDOR_CAPABILITY_MATRIX,
  evaluateLatestObservation,
  getPublicRouteIntelligenceSnapshot,
  observationStaleAfter,
  WISE_API_COMPONENT_ID,
  WISE_PAYMENTS_COMPONENT_ID,
  WISE_WEBSITE_COMPONENT_ID,
} from '@/lib/route-intelligence';
import {
  getLatestWiseIncidentObservations,
  listWiseIncidentHistory,
  persistOperationalHealthObservation,
  persistPaymentIncidentObservation,
  type ObservationRepository,
  type StoredObservationRow,
} from '@/lib/route-intelligence/observation-store.server';
import {
  parseWiseIncidentObservations,
  parseWisePaymentsObservation,
  WISE_STATUS_SUMMARY_URL,
} from '@/lib/route-intelligence/wise-status-adapter';
import type {
  ProviderOperationalHealthObservation,
  ProviderPaymentIncidentObservation,
} from '@/lib/route-intelligence/types';

const FETCHED_AT = new Date('2026-09-10T14:00:00.000Z');
const NOW = new Date('2026-09-10T15:00:00.000Z');

function component(id: string, name: string, status: string) {
  return { id, name, status };
}

function incidentUpdate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rhl4xn17l6lj',
    status: 'identified',
    body: 'Customers will continue to see some delays impacting AED transfers.',
    created_at: '2026-09-07T14:57:43.663+01:00',
    affected_components: [
      { code: WISE_API_COMPONENT_ID, name: 'API', old_status: 'operational', new_status: 'operational' },
      { code: WISE_PAYMENTS_COMPONENT_ID, name: 'Payments', old_status: 'operational', new_status: 'operational' },
    ],
    ...overrides,
  };
}

function aedIncident(overrides: Record<string, unknown> = {}) {
  return {
    id: '10dy3hydcfdt',
    name: 'Delayed AED payments',
    status: 'identified',
    impact: 'minor',
    started_at: '2026-08-24T11:05:30.884+01:00',
    updated_at: '2026-09-07T14:57:43.665+01:00',
    resolved_at: null,
    shortlink: 'https://stspg.io/8rb76dvwykb3',
    components: [
      component(WISE_PAYMENTS_COMPONENT_ID, 'Payments', 'operational'),
      component(WISE_API_COMPONENT_ID, 'API', 'operational'),
    ],
    incident_updates: [
      incidentUpdate(),
      {
        ...incidentUpdate(),
        id: 'qnqm22n6m72c',
        created_at: '2026-08-24T11:05:30.993+01:00',
        body: "We're aware of an issue that's affecting customers sending AED.",
      },
    ],
    ...overrides,
  };
}

function summary(overrides: { incidents?: Record<string, unknown>[] } = {}) {
  return {
    page: {
      id: 'hg7qg2qssg6b',
      name: 'Wise',
      updated_at: '2026-09-10T13:09:10.107+01:00',
    },
    status: { indicator: 'none', description: 'All Systems Operational' },
    components: [
      component(WISE_WEBSITE_COMPONENT_ID, 'Website', 'operational'),
      component(WISE_PAYMENTS_COMPONENT_ID, 'Payments', 'operational'),
      component(WISE_API_COMPONENT_ID, 'API', 'operational'),
    ],
    incidents: overrides.incidents ?? [aedIncident()],
  };
}

function healthObservation(): ProviderOperationalHealthObservation {
  const parsed = parseWisePaymentsObservation(summary(), FETCHED_AT);
  if (!parsed.ok) throw new Error('expected health parse');
  return parsed.observation;
}

function memoryRepository(): ObservationRepository & { rows: StoredObservationRow[] } {
  const rows: StoredObservationRow[] = [];
  return {
    rows,
    async findLatestBySubject(subjectId) {
      return (
        [...rows]
          .filter((row) => row.subjectId === subjectId)
          .sort((a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime())[0] ?? null
      );
    },
    async listByType(observationType) {
      return rows.filter((row) => row.observationType === observationType);
    },
    async insert(input) {
      const row: StoredObservationRow = {
        ...input,
        id: `row-${rows.length + 1}`,
        createdAt: input.fetchedAt,
      };
      rows.push(row);
      return row;
    },
    async updateFetchTimestamps(id, fetchedAt, staleAfter) {
      const row = rows.find((item) => item.id === id);
      if (!row) return;
      row.fetchedAt = fetchedAt;
      row.staleAfter = staleAfter;
    },
  };
}

describe('Wise payment incidents', () => {
  it('keeps operational Payments and an active AED incident as separate facts', () => {
    const payload = summary();
    const health = parseWisePaymentsObservation(payload, FETCHED_AT);
    const incidents = parseWiseIncidentObservations(payload, FETCHED_AT);

    expect(health.ok).toBe(true);
    if (!health.ok) return;
    expect(health.observation.value.componentStatus).toBe('operational');
    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.value.title).toBe('Delayed AED payments');
    expect(incidents[0]?.value.status).toBe('identified');
    expect(incidents[0]?.value.impact).toBe('minor');
    expect(incidents[0]?.value.description).toContain('AED transfers');
    expect(incidents[0]?.value.affectedComponentIds).toEqual(
      expect.arrayContaining([WISE_PAYMENTS_COMPONENT_ID, WISE_API_COMPONENT_ID])
    );
    expect(incidents[0]?.value.routeRelevance).toBe('unknown');
    expect(incidents[0]?.provenance).toBe('externally_sourced');
    expect(incidents[0]?.sourceUrl).toBe('https://status.wise.com/incidents/10dy3hydcfdt');
    expect(incidents[0]?.sourceId).toBe('wise_statuspage');
    expect(incidents[0]?.observedAt).toBeTruthy();
    expect(incidents[0]?.fetchedAt).toBe(FETCHED_AT.toISOString());
  });

  it('does not change component health because an incident exists', () => {
    const withIncident = parseWisePaymentsObservation(summary(), FETCHED_AT);
    const withoutIncident = parseWisePaymentsObservation(summary({ incidents: [] }), FETCHED_AT);
    expect(withIncident.ok && withoutIncident.ok).toBe(true);
    if (!withIncident.ok || !withoutIncident.ok) return;
    expect(withIncident.observation.value.componentStatus).toBe(
      withoutIncident.observation.value.componentStatus
    );
  });

  it('does not treat a Website incident as payment-route health', () => {
    const payload = summary({
      incidents: [
        aedIncident({
          id: 'website-1',
          name: 'Website degraded',
          components: [component(WISE_WEBSITE_COMPONENT_ID, 'Website', 'degraded_performance')],
          incident_updates: [
            incidentUpdate({
              affected_components: [
                { code: WISE_WEBSITE_COMPONENT_ID, name: 'Website' },
              ],
            }),
          ],
        }),
      ],
    });
    const health = parseWisePaymentsObservation(payload, FETCHED_AT);
    const incidents = parseWiseIncidentObservations(payload, FETCHED_AT);
    const snapshot = getPublicRouteIntelligenceSnapshot({
      wisePaymentsHealth: evaluateLatestObservation(health.ok ? health.observation : null, NOW),
      wiseIncidents: incidents,
      now: NOW,
    });

    expect(health.ok && health.observation.value.componentStatus).toBe('operational');
    expect(snapshot.incidents).toEqual([]);
    expect(snapshot.otherIncidents[0]?.value.affectedComponentIds).toEqual([WISE_WEBSITE_COMPONENT_ID]);
    expect(snapshot.offerings.find((item) => item.id === 'wise-international')?.availability).toMatchObject({
      componentStatus: 'operational',
    });
  });

  it('keeps an API-only incident distinct from Payments', () => {
    const incidents = parseWiseIncidentObservations(
      summary({
        incidents: [
          aedIncident({
            id: 'api-1',
            name: 'API errors',
            components: [component(WISE_API_COMPONENT_ID, 'API', 'partial_outage')],
            incident_updates: [
              incidentUpdate({
                body: 'API latency is elevated.',
                affected_components: [{ code: WISE_API_COMPONENT_ID, name: 'API' }],
              }),
            ],
          }),
        ],
      }),
      FETCHED_AT
    );
    const snapshot = getPublicRouteIntelligenceSnapshot({
      wiseIncidents: incidents,
      now: NOW,
    });
    expect(snapshot.incidents).toEqual([]);
    expect(snapshot.otherIncidents[0]?.value.affectedComponentIds).toEqual([WISE_API_COMPONENT_ID]);
    expect(snapshot.otherIncidents[0]?.value.title).toBe('API errors');
  });

  it('does not convert incident text into a corridor or currency eligibility rule', () => {
    const [incident] = parseWiseIncidentObservations(summary(), FETCHED_AT);
    expect(incident?.value.routeRelevance).toBe('unknown');
    expect(incident).not.toHaveProperty('currency');
    expect(incident?.value).not.toHaveProperty('destination');
    expect(JSON.stringify(incident)).not.toContain('AU→AE');
    expect(CORRIDOR_CAPABILITY_MATRIX.every((row) => row.origin !== 'AE')).toBe(true);
  });

  it('creates history when incident status or update changes and keeps resolved records', async () => {
    const repo = memoryRepository();
    const identified = parseWiseIncidentObservations(summary(), FETCHED_AT)[0]!;
    const monitoring: ProviderPaymentIncidentObservation = {
      ...identified,
      fetchedAt: '2026-09-10T14:30:00.000Z',
      staleAfter: observationStaleAfter('2026-09-10T14:30:00.000Z').toISOString(),
      value: {
        ...identified.value,
        status: 'monitoring',
        latestUpdateId: 'update-2',
      },
    };
    const resolved: ProviderPaymentIncidentObservation = {
      ...identified,
      fetchedAt: '2026-09-10T15:00:00.000Z',
      staleAfter: observationStaleAfter('2026-09-10T15:00:00.000Z').toISOString(),
      observedAt: '2026-09-10T15:00:00.000Z',
      value: {
        ...identified.value,
        status: 'resolved',
        resolvedAt: '2026-09-10T15:00:00.000Z',
        latestUpdateId: 'update-3',
      },
    };

    expect((await persistPaymentIncidentObservation(repo, identified)).action).toBe('inserted');
    expect((await persistPaymentIncidentObservation(repo, monitoring)).action).toBe('inserted');
    expect((await persistPaymentIncidentObservation(repo, resolved)).action).toBe('inserted');

    const history = await listWiseIncidentHistory(repo, '10dy3hydcfdt');
    expect(history.map((item) => item.value.status)).toEqual([
      'identified',
      'monitoring',
      'resolved',
    ]);
    expect(history[2]?.value.resolvedAt).toBe('2026-09-10T15:00:00.000Z');
  });

  it('refreshes unchanged incidents instead of duplicating them', async () => {
    const repo = memoryRepository();
    const first = parseWiseIncidentObservations(summary(), FETCHED_AT)[0]!;
    const same = parseWiseIncidentObservations(
      summary(),
      new Date('2026-09-10T14:45:00.000Z')
    )[0]!;

    await persistPaymentIncidentObservation(repo, first);
    const refreshed = await persistPaymentIncidentObservation(repo, same);
    expect(refreshed.action).toBe('refreshed');
    expect(repo.rows.filter((row) => row.observationType === 'provider_payment_incident')).toHaveLength(1);
    expect(repo.rows[0]?.fetchedAt.toISOString()).toBe('2026-09-10T14:45:00.000Z');
  });

  it('attaches the AED incident to the snapshot without changing offering availability', () => {
    const incidents = parseWiseIncidentObservations(summary(), FETCHED_AT);
    const snapshot = getPublicRouteIntelligenceSnapshot({
      wisePaymentsHealth: evaluateLatestObservation(healthObservation(), NOW),
      wiseIncidents: incidents,
      now: NOW,
    });

    expect(snapshot.incidents).toHaveLength(1);
    expect(snapshot.incidents[0]?.value.title).toBe('Delayed AED payments');
    expect(snapshot.incidents[0]?.value.impact).toBe('minor');
    expect(snapshot.offerings.find((item) => item.id === 'wise-international')?.availability).toMatchObject({
      provenance: 'externally_sourced',
      componentStatus: 'operational',
    });
    expect(snapshot.capabilities).toBe(CORRIDOR_CAPABILITY_MATRIX);
  });

  it('does not change public ranking goldens when an incident is attached', () => {
    const query = {
      ...DEFAULT_LANDING_SEARCH,
      originCountry: 'AU' as const,
      destinationCountry: 'ID' as const,
      transactionType: 'supplier_payment' as const,
      priority: 'lowest_cost' as const,
    };
    getPublicRouteIntelligenceSnapshot({
      wisePaymentsHealth: evaluateLatestObservation(healthObservation(), NOW),
      wiseIncidents: parseWiseIncidentObservations(summary(), FETCHED_AT),
      now: NOW,
    });
    const result = compareLandingRoutes(query);
    expect(rankLandingRoutes(query)[0]?.id).toBe('international_bank');
    expect(result.recommendedOffering.offering.id).toBe('wise-international');
  });

  it('does not persist the entire incident update history on one poll', () => {
    const incidents = parseWiseIncidentObservations(summary(), FETCHED_AT);
    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.value.latestUpdateId).toBe('rhl4xn17l6lj');
    expect(incidents[0]?.rawEvidence).not.toHaveProperty('incident_updates');
  });

  it('lists latest incident observations from the shared table', async () => {
    const repo = memoryRepository();
    await persistOperationalHealthObservation(repo, healthObservation());
    await persistPaymentIncidentObservation(
      repo,
      parseWiseIncidentObservations(summary(), FETCHED_AT)[0]!
    );
    const latest = await getLatestWiseIncidentObservations(repo);
    expect(latest).toHaveLength(1);
    expect(latest[0]?.value.incidentId).toBe('10dy3hydcfdt');
  });

  it('does not fetch the status host from public comparison', () => {
    expect(WISE_STATUS_SUMMARY_URL).toContain('status.wise.com');
    compareLandingRoutes(DEFAULT_LANDING_SEARCH);
  });
});
