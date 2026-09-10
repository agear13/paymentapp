import {
  getLatestWisePaymentsObservation,
  persistOperationalHealthObservation,
  toInsertRow,
  type ObservationRepository,
  type StoredObservationRow,
} from '@/lib/route-intelligence/observation-store.server';
import { observationStaleAfter } from '@/lib/route-intelligence/observation';
import type { ProviderOperationalHealthObservation } from '@/lib/route-intelligence/types';

function observation(
  componentStatus: ProviderOperationalHealthObservation['value']['componentStatus'],
  fetchedAt: string
): ProviderOperationalHealthObservation {
  return {
    observationType: 'provider_operational_health',
    subjectKind: 'provider_component',
    subjectId: 'wise:payments',
    providerId: 'wise',
    value: {
      pageIndicator: componentStatus === 'operational' ? 'none' : 'major',
      pageDescription: componentStatus === 'operational' ? 'All Systems Operational' : 'Outage',
      componentId: '2jxb8y760wrd',
      componentName: 'Payments',
      componentStatus,
    },
    observedAt: '2026-09-10T13:09:10.107Z',
    fetchedAt,
    sourceId: 'wise_statuspage',
    sourceUrl: 'https://status.wise.com/api/v2/summary.json',
    provenance: 'externally_sourced',
    confidence: 'high',
    staleAfter: observationStaleAfter(fetchedAt).toISOString(),
    rawHash: `${componentStatus}-${fetchedAt}`,
    rawEvidence: {
      pageUpdatedAt: '2026-09-10T13:09:10.107Z',
      pageIndicator: componentStatus === 'operational' ? 'none' : 'major',
      pageDescription: componentStatus === 'operational' ? 'All Systems Operational' : 'Outage',
      componentId: '2jxb8y760wrd',
      componentName: 'Payments',
      componentStatus,
    },
  };
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

describe('observation persistence', () => {
  it('inserts the first observation and later state changes', async () => {
    const repo = memoryRepository();
    const first = await persistOperationalHealthObservation(
      repo,
      observation('operational', '2026-09-10T12:00:00.000Z')
    );
    const degraded = await persistOperationalHealthObservation(
      repo,
      observation('degraded_performance', '2026-09-10T13:00:00.000Z')
    );
    const outage = await persistOperationalHealthObservation(
      repo,
      observation('major_outage', '2026-09-10T14:00:00.000Z')
    );
    const recovered = await persistOperationalHealthObservation(
      repo,
      observation('operational', '2026-09-10T15:00:00.000Z')
    );

    expect(first.action).toBe('inserted');
    expect(degraded.action).toBe('inserted');
    expect(outage.action).toBe('inserted');
    expect(recovered.action).toBe('inserted');
    expect(repo.rows).toHaveLength(4);
    expect(
      repo.rows.map((row) => (row.value as { componentStatus: string }).componentStatus)
    ).toEqual([
      'operational',
      'degraded_performance',
      'major_outage',
      'operational',
    ]);
  });

  it('refreshes fetchedAt instead of duplicating an unchanged health state', async () => {
    const repo = memoryRepository();
    await persistOperationalHealthObservation(
      repo,
      observation('operational', '2026-09-10T12:00:00.000Z')
    );
    const refreshed = await persistOperationalHealthObservation(
      repo,
      observation('operational', '2026-09-10T13:00:00.000Z')
    );

    expect(refreshed.action).toBe('refreshed');
    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0]?.fetchedAt.toISOString()).toBe('2026-09-10T13:00:00.000Z');
    expect((repo.rows[0]?.value as { componentStatus: string }).componentStatus).toBe(
      'operational'
    );
    expect(repo.rows[0]?.observedAt.toISOString()).toBe('2026-09-10T13:09:10.107Z');
  });

  it('reads the latest Wise Payments observation and applies freshness', async () => {
    const repo = memoryRepository();
    await persistOperationalHealthObservation(
      repo,
      observation('operational', '2026-09-10T14:00:00.000Z')
    );

    const current = await getLatestWisePaymentsObservation(
      repo,
      new Date('2026-09-10T15:00:00.000Z')
    );
    expect(current.kind).toBe('current');

    const stale = await getLatestWisePaymentsObservation(
      repo,
      new Date('2026-09-10T18:00:00.000Z')
    );
    expect(stale.kind).toBe('stale');

    const empty = await getLatestWisePaymentsObservation(memoryRepository());
    expect(empty).toEqual({ kind: 'unavailable', reason: 'missing' });
  });

  it('maps an observation into the persistence row shape', () => {
    const row = toInsertRow(observation('operational', '2026-09-10T14:00:00.000Z'));
    expect(row.observationType).toBe('provider_operational_health');
    expect(row.subjectId).toBe('wise:payments');
    expect(row.provenance).toBe('externally_sourced');
    expect(row.sourceUrl).toContain('status.wise.com');
  });
});
