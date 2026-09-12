import { compareLandingRoutes, DEFAULT_LANDING_SEARCH, rankLandingRoutes } from '@/lib/journey/landing-route-comparison';
import {
  buildProviderFeeObservation,
  createRouteSubject,
  feeObservationAppliesToRoute,
  feeObservationSubjectId,
  getPublicRouteIntelligenceSnapshot,
  isObservationFresh,
  observationStaleAfter,
} from '@/lib/route-intelligence';
import {
  listProviderFeeHistory,
  persistProviderFeeObservation,
  type ObservationRepository,
  type StoredObservationRow,
} from '@/lib/route-intelligence/observation-store.server';
import type { ProviderFeeObservation, RouteSubject } from '@/lib/route-intelligence/types';
import fs from 'fs';
import path from 'path';

const NOW = new Date('2026-09-10T15:00:00.000Z');

const WISE_AUD_IDR: RouteSubject = createRouteSubject({
  providerId: 'wise',
  offeringId: 'wise-international',
  mechanismId: 'international_bank',
  corridor: { origin: 'AU', destination: 'ID' },
  sourceCurrency: 'AUD',
  destinationCurrency: 'IDR',
  networkRail: 'unknown',
});

function feeObservation(overrides: {
  route?: RouteSubject;
  amount?: number | null;
  sourceCurrency?: string | null;
  feeAmount?: number | null;
  feeCurrency?: string | null;
  feeModel?: ProviderFeeObservation['value']['feeModel'];
  feePercent?: number | null;
  fetchedAt?: string;
  observedAt?: string;
  rawHash?: string;
} = {}): ProviderFeeObservation {
  const route = overrides.route ?? WISE_AUD_IDR;
  const amount = overrides.amount === undefined ? 10000 : overrides.amount;
  const sourceCurrency = overrides.sourceCurrency === undefined ? 'AUD' : overrides.sourceCurrency;
  const fetchedAt = overrides.fetchedAt ?? '2026-09-10T14:00:00.000Z';
  return buildProviderFeeObservation({
    route,
    amount,
    sourceCurrency,
    feeAmount: overrides.feeAmount === undefined ? 37 : overrides.feeAmount,
    feeCurrency: overrides.feeCurrency === undefined ? 'AUD' : overrides.feeCurrency,
    feeModel: overrides.feeModel ?? 'fixed',
    feePercent: overrides.feePercent ?? null,
    observedAt: overrides.observedAt ?? '2026-09-10T13:00:00.000Z',
    fetchedAt,
    sourceId: 'test_fee_fixture',
    sourceUrl: 'https://example.test/route-intelligence/fee-observation',
    rawHash: overrides.rawHash ?? `fee-${amount}-${fetchedAt}`,
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

describe('provider_fee_observation', () => {
  it('persists an A$10,000 fee observation with provenance', async () => {
    const repo = memoryRepository();
    const observation = feeObservation({ amount: 10000 });
    const saved = await persistProviderFeeObservation(repo, observation);
    expect(saved.action).toBe('inserted');
    expect(saved.observation.subjectId).toBe(
      feeObservationSubjectId(WISE_AUD_IDR, 10000, 'AUD')
    );
    expect(saved.observation.provenance).toBe('externally_sourced');
    expect(saved.observation.confidence).toBe('high');
    expect(saved.observation.sourceId).toBe('test_fee_fixture');
    expect(saved.observation.value.amount).toBe(10000);
    expect(saved.observation.value.route.currencyPair).toEqual({ source: 'AUD', target: 'IDR' });
    expect(repo.rows).toHaveLength(1);
  });

  it('lets A$10,000 and A$100,000 coexist for the same route', async () => {
    const repo = memoryRepository();
    await persistProviderFeeObservation(repo, feeObservation({ amount: 10000, feeAmount: 37 }));
    await persistProviderFeeObservation(repo, feeObservation({ amount: 100000, feeAmount: 91 }));
    expect(repo.rows).toHaveLength(2);
    expect(repo.rows[0]?.subjectId).not.toBe(repo.rows[1]?.subjectId);
    expect(feeObservationAppliesToRoute(feeObservation({ amount: 10000 }), WISE_AUD_IDR, 10000)).toBe(
      true
    );
    expect(feeObservationAppliesToRoute(feeObservation({ amount: 10000 }), WISE_AUD_IDR, 100000)).toBe(
      false
    );
  });

  it('retains history when the same amount is observed at a later timestamp with a new fee', async () => {
    const repo = memoryRepository();
    const first = feeObservation({
      amount: 10000,
      feeAmount: 37,
      fetchedAt: '2026-09-10T12:00:00.000Z',
    });
    const second = feeObservation({
      amount: 10000,
      feeAmount: 41,
      fetchedAt: '2026-09-10T14:00:00.000Z',
    });
    await persistProviderFeeObservation(repo, first);
    await persistProviderFeeObservation(repo, second);
    const history = await listProviderFeeHistory(repo, first.subjectId);
    expect(history).toHaveLength(2);
    expect(history.map((item) => item.value.feeAmount)).toEqual([37, 41]);
  });

  it('does not match across currency pairs, providers, mechanisms, or rails', () => {
    const tenThousand = feeObservation({ amount: 10000 });
    const thb = createRouteSubject({
      providerId: 'wise',
      offeringId: 'wise-international',
      mechanismId: 'international_bank',
      corridor: { origin: 'AU', destination: 'TH' },
      sourceCurrency: 'AUD',
      destinationCurrency: 'THB',
      networkRail: 'unknown',
    });
    const airwallex = createRouteSubject({
      providerId: 'airwallex',
      offeringId: 'airwallex-international',
      mechanismId: 'international_bank',
      corridor: { origin: 'AU', destination: 'ID' },
      sourceCurrency: 'AUD',
      destinationCurrency: 'IDR',
      networkRail: 'unknown',
    });
    const local = createRouteSubject({
      providerId: 'wise',
      offeringId: 'wise-local',
      mechanismId: 'local_currency_settlement',
      corridor: { origin: 'AU', destination: 'ID' },
      sourceCurrency: 'AUD',
      destinationCurrency: 'IDR',
      networkRail: 'unknown',
    });
    const swift = createRouteSubject({
      providerId: 'wise',
      offeringId: 'wise-international',
      mechanismId: 'international_bank',
      corridor: { origin: 'AU', destination: 'ID' },
      sourceCurrency: 'AUD',
      destinationCurrency: 'IDR',
      networkRail: 'swift',
    });
    expect(feeObservationAppliesToRoute(tenThousand, thb, 10000)).toBe(false);
    expect(feeObservationAppliesToRoute(tenThousand, airwallex, 10000)).toBe(false);
    expect(feeObservationAppliesToRoute(tenThousand, local, 10000)).toBe(false);
    expect(feeObservationAppliesToRoute(tenThousand, swift, 10000)).toBe(false);
  });

  it('uses the existing 3-hour freshness window', () => {
    const fresh = feeObservation({ fetchedAt: '2026-09-10T14:00:00.000Z' });
    const stale = feeObservation({ fetchedAt: '2026-09-10T11:00:00.000Z' });
    expect(isObservationFresh(fresh, NOW)).toBe(true);
    expect(isObservationFresh(stale, NOW)).toBe(false);
    expect(new Date(stale.staleAfter).getTime()).toBe(
      observationStaleAfter('2026-09-10T11:00:00.000Z').getTime()
    );
  });

  it('does not convert indicative catalog fees into observed fees', () => {
    const snapshot = getPublicRouteIntelligenceSnapshot();
    expect(snapshot.feeObservations).toEqual([]);
    expect(snapshot.offerings.every((item) => item.pricing.provenance === 'indicative')).toBe(true);
    expect(snapshot.offerings.every((item) => item.pricing.observedAt === null)).toBe(true);
  });

  it('attaches supplied fee observations on the snapshot without ranking them', () => {
    const observation = feeObservation({ amount: 10000 });
    const snapshot = getPublicRouteIntelligenceSnapshot({ feeObservations: [observation] });
    expect(snapshot.feeObservations).toHaveLength(1);
    expect(snapshot.feeObservations[0]?.value.amount).toBe(10000);

    const comparison = compareLandingRoutes({
      ...DEFAULT_LANDING_SEARCH,
      priority: 'lowest_cost',
    });
    expect(comparison.recommendedOffering.id).toBe('wise-international');
    expect(rankLandingRoutes({ ...DEFAULT_LANDING_SEARCH, priority: 'lowest_cost' })[0]?.id).toBe(
      'international_bank'
    );
  });

  it('makes no provider API or network request', () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    getPublicRouteIntelligenceSnapshot({ feeObservations: [feeObservation()] });
    compareLandingRoutes(DEFAULT_LANDING_SEARCH);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();

    const comparison = fs.readFileSync(
      path.join(process.cwd(), 'lib/journey/landing-route-comparison.ts'),
      'utf8'
    );
    const rank = fs.readFileSync(path.join(process.cwd(), 'lib/journey/landing-route-rank.ts'), 'utf8');
    const eligibility = fs.readFileSync(
      path.join(process.cwd(), 'lib/route-intelligence/route-eligibility.ts'),
      'utf8'
    );
    expect(comparison).not.toContain('fetch(');
    expect(rank).not.toContain('provider_fee_observation');
    expect(eligibility).not.toContain('provider_fee_observation');
  });
});
