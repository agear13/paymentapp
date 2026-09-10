import {
  buildRailRegulatoryObservation,
  isObservationFresh,
  observationStaleAfter,
  REGULATORY_STORE_PROVIDER_ID,
  regulatoryObservationSubjectId,
} from '@/lib/route-intelligence';
import {
  listRailRegulatoryObservations,
  persistRailRegulatoryObservation,
  toInsertRow,
  type ObservationRepository,
  type StoredObservationRow,
} from '@/lib/route-intelligence/observation-store.server';
import type { RailRegulatoryObservation, RegulatoryStatus } from '@/lib/route-intelligence/types';

const NOW = new Date('2026-09-10T15:00:00.000Z');

function observation(overrides: {
  railId?: string;
  jurisdiction?: string | null;
  paymentType?: string | null;
  currency?: string | null;
  participantType?: string | null;
  status?: RegulatoryStatus;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  fetchedAt?: string;
  observedAt?: string;
  sourceUrl?: string;
  source?: string;
} = {}): RailRegulatoryObservation {
  const fetchedAt = overrides.fetchedAt ?? '2026-09-10T14:00:00.000Z';
  return buildRailRegulatoryObservation({
    railId: overrides.railId ?? 'bi_fast',
    jurisdiction: overrides.jurisdiction === undefined ? 'ID' : overrides.jurisdiction,
    paymentType: overrides.paymentType === undefined ? 'supplier_payment' : overrides.paymentType,
    currency: overrides.currency === undefined ? 'IDR' : overrides.currency,
    participantType: overrides.participantType === undefined ? 'bank' : overrides.participantType,
    status: overrides.status ?? 'prohibited',
    effectiveFrom: overrides.effectiveFrom === undefined ? '2026-01-01T00:00:00.000Z' : overrides.effectiveFrom,
    effectiveTo: overrides.effectiveTo === undefined ? null : overrides.effectiveTo,
    observedAt: overrides.observedAt ?? '2026-09-10T13:00:00.000Z',
    fetchedAt,
    sourceId: 'test_regulatory_fixture',
    sourceUrl: overrides.sourceUrl ?? 'https://example.test/bi/regulatory',
    source: overrides.source ?? 'Bank Indonesia test fixture',
    rawHash: `reg-${overrides.railId ?? 'bi_fast'}-${overrides.status ?? 'prohibited'}`,
  });
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

describe('regulatory observations', () => {
  it('attaches to a specific rail', () => {
    const item = observation({ railId: 'bi_fast' });
    expect(item.observationType).toBe('rail_regulatory_observation');
    expect(item.subjectKind).toBe('rail');
    expect(item.providerId).toBeNull();
    expect(item.value.railId).toBe('bi_fast');
    expect(item.subjectId).toContain('bi_fast');
  });

  it('attaches to a specific jurisdiction', () => {
    const item = observation({ jurisdiction: 'ID' });
    expect(item.value.jurisdiction).toBe('ID');
    expect(item.subjectId).toContain('j:ID');
  });

  it('attaches to a specific payment type', () => {
    const item = observation({ paymentType: 'supplier_payment' });
    expect(item.value.paymentType).toBe('supplier_payment');
    expect(item.subjectId).toContain('pt:supplier_payment');
  });

  it('attaches to a specific participant type', () => {
    const item = observation({ participantType: 'non_bank_psp' });
    expect(item.value.participantType).toBe('non_bank_psp');
    expect(item.subjectId).toContain('part:non_bank_psp');
  });

  it('preserves effectiveFrom and effectiveTo', () => {
    const item = observation({
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveTo: '2026-12-31T23:59:59.000Z',
    });
    expect(item.value.effectiveFrom).toBe('2026-01-01T00:00:00.000Z');
    expect(item.value.effectiveTo).toBe('2026-12-31T23:59:59.000Z');
    expect(item.rawEvidence.effectiveFrom).toBe('2026-01-01T00:00:00.000Z');
    expect(item.rawEvidence.effectiveTo).toBe('2026-12-31T23:59:59.000Z');
  });

  it('preserves observedAt and fetchedAt', () => {
    const item = observation({
      observedAt: '2026-09-01T08:00:00.000Z',
      fetchedAt: '2026-09-01T09:00:00.000Z',
    });
    expect(item.observedAt).toBe('2026-09-01T08:00:00.000Z');
    expect(item.fetchedAt).toBe('2026-09-01T09:00:00.000Z');
    expect(item.staleAfter).toBe(observationStaleAfter('2026-09-01T09:00:00.000Z').toISOString());
  });

  it('treats stale evidence as unknown freshness, not permitted or prohibited', () => {
    const item = observation({ fetchedAt: '2026-09-10T10:00:00.000Z' });
    expect(isObservationFresh(item, NOW)).toBe(false);
    expect(item.value.status).toBe('prohibited');
    expect(isObservationFresh(item, NOW)).not.toBe(item.value.status === 'prohibited');
  });

  it('lets multiple rail observations coexist', async () => {
    const repo = memoryRepository();
    await persistRailRegulatoryObservation(repo, observation({ railId: 'bi_fast' }));
    await persistRailRegulatoryObservation(repo, observation({ railId: 'sknbi', status: 'permitted' }));
    const rows = await listRailRegulatoryObservations(repo);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.value.railId).sort()).toEqual(['bi_fast', 'sknbi']);
  });

  it('lets multiple effective periods coexist', async () => {
    const repo = memoryRepository();
    await persistRailRegulatoryObservation(
      repo,
      observation({
        effectiveFrom: '2025-01-01T00:00:00.000Z',
        effectiveTo: '2025-12-31T23:59:59.000Z',
        status: 'restricted',
      })
    );
    await persistRailRegulatoryObservation(
      repo,
      observation({
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        effectiveTo: null,
        status: 'prohibited',
      })
    );
    const rows = await listRailRegulatoryObservations(repo);
    expect(rows).toHaveLength(2);
    expect(regulatoryObservationSubjectId(rows[0]!.value)).not.toBe(
      regulatoryObservationSubjectId(rows[1]!.value)
    );
  });

  it('preserves provenance and source URL', () => {
    const item = observation({
      sourceUrl: 'https://www.bi.go.id/en/publikasi/ruang-media/news-release/Pages/sp_2333421.aspx',
      source: 'Bank Indonesia',
    });
    expect(item.sourceUrl).toBe(
      'https://www.bi.go.id/en/publikasi/ruang-media/news-release/Pages/sp_2333421.aspx'
    );
    expect(item.provenance).toBe('externally_sourced');
    expect(item.rawEvidence.source).toBe('Bank Indonesia');
    const row = toInsertRow(item);
    expect(row.providerId).toBe(REGULATORY_STORE_PROVIDER_ID);
    expect(row.sourceUrl).toBe(item.sourceUrl);
  });
});
