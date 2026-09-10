import {
  availabilityObservationSubjectId,
  buildProviderFeeObservation,
  buildRouteAvailabilityObservation,
  buildRouteFxObservation,
  buildRouteSettlementObservation,
  createRouteSubject,
  fxObservationAppliesToRoute,
  fxObservationSubjectId,
  isObservationFresh,
  observationStaleAfter,
  routeSubjectKey,
} from '@/lib/route-intelligence';
import {
  persistRouteFxObservation,
  type ObservationRepository,
  type StoredObservationRow,
} from '@/lib/route-intelligence/observation-store.server';
import type { RouteSubject } from '@/lib/route-intelligence/types';

const NOW = new Date('2026-09-10T15:00:00.000Z');

const AU_ID: RouteSubject = createRouteSubject({
  providerId: 'wise',
  offeringId: 'wise-international',
  mechanismId: 'international_bank',
  corridor: { origin: 'AU', destination: 'ID' },
  sourceCurrency: 'AUD',
  destinationCurrency: 'IDR',
  networkRail: 'unknown',
});

const ID_ID: RouteSubject = createRouteSubject({
  providerId: 'bank',
  offeringId: 'bank-domestic-id',
  mechanismId: 'domestic_bank',
  corridor: { origin: 'ID', destination: 'ID' },
  sourceCurrency: 'IDR',
  destinationCurrency: 'IDR',
  networkRail: 'bi_fast',
});

function fx(overrides: Partial<Parameters<typeof buildRouteFxObservation>[0]> = {}) {
  const fetchedAt = overrides.fetchedAt ?? '2026-09-10T14:00:00.000Z';
  return buildRouteFxObservation({
    route: AU_ID,
    sourceCurrency: 'AUD',
    destinationCurrency: 'IDR',
    sourceAmount: 10000,
    destinationAmount: 25000,
    exchangeRate: 2.5,
    rateKind: 'provider_quoted',
    rateSource: 'phase8_fx_fixture',
    includesSpread: false,
    observedAt: '2026-09-10T13:00:00.000Z',
    fetchedAt,
    sourceId: 'phase8_fx_fixture',
    sourceUrl: 'https://example.test/route-intelligence/fx-fixture',
    rawHash: 'fx-fixture-2.5',
    ...overrides,
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

describe('FX observation', () => {
  it('identifies FX by route plus amount dimension', () => {
    const ten = fx({ sourceAmount: 10000 });
    const hundred = fx({ sourceAmount: 100000, rawHash: 'fx-100000' });
    expect(ten.observationType).toBe('route_fx_observation');
    expect(ten.subjectId).toBe(fxObservationSubjectId(AU_ID, 10000, 'AUD', 'IDR'));
    expect(ten.subjectId).not.toBe(hundred.subjectId);
    expect(routeSubjectKey(ten.value.route)).toBe(routeSubjectKey(hundred.value.route));
    expect(ten.value.rateKind).toBe('provider_quoted');
    expect(ten.value.rateKind).not.toBe('mid_market_reference');
  });

  it('keeps mid-market, quoted, indicative, and executed distinct', () => {
    expect(fx({ rateKind: 'mid_market_reference' }).value.rateKind).toBe('mid_market_reference');
    expect(fx({ rateKind: 'indicative' }).value.rateKind).toBe('indicative');
    expect(fx({ rateKind: 'executed' }).value.rateKind).toBe('executed');
    expect(fx({ rateKind: 'provider_quoted' }).value.rateKind).not.toBe('indicative');
  });

  it('is fresh inside the existing freshness window', () => {
    const item = fx({ fetchedAt: '2026-09-10T14:00:00.000Z' });
    expect(isObservationFresh(item, NOW)).toBe(true);
    expect(item.staleAfter).toBe(observationStaleAfter('2026-09-10T14:00:00.000Z').toISOString());
  });

  it('treats stale FX as not fresh', () => {
    const item = fx({ fetchedAt: '2026-09-10T10:00:00.000Z' });
    expect(isObservationFresh(item, NOW)).toBe(false);
  });

  it('does not apply an amount-specific FX observation to another amount', () => {
    expect(fxObservationAppliesToRoute(fx({ sourceAmount: 10000 }), AU_ID, 10000)).toBe(true);
    expect(fxObservationAppliesToRoute(fx({ sourceAmount: 10000 }), AU_ID, 100000)).toBe(false);
  });
});

describe('settlement observation', () => {
  it('identifies settlement by RouteSubject, not amount', () => {
    const item = buildRouteSettlementObservation({
      route: AU_ID,
      band: 'unknown',
      durationMin: null,
      durationMax: null,
      unit: 'unknown',
      settlementModel: 'phase8_settlement_fixture',
      observedAt: '2026-09-10T13:00:00.000Z',
      fetchedAt: '2026-09-10T14:00:00.000Z',
      sourceId: 'phase8_settlement_fixture',
      sourceUrl: 'https://example.test/route-intelligence/settlement-fixture',
      rawHash: 'settlement-unknown',
    });
    expect(item.observationType).toBe('route_settlement_observation');
    expect(item.subjectId).toContain(routeSubjectKey(AU_ID));
    expect(item.value.band).toBe('unknown');
    expect(isObservationFresh(item, NOW)).toBe(true);
  });
});

describe('route availability observation', () => {
  it('is distinct from provider operational health', () => {
    const item = buildRouteAvailabilityObservation({
      route: AU_ID,
      status: 'available',
      reason: 'phase8_availability_fixture',
      paymentType: 'supplier_payment',
      observedAt: '2026-09-10T13:00:00.000Z',
      fetchedAt: '2026-09-10T14:00:00.000Z',
      sourceId: 'phase8_availability_fixture',
      sourceUrl: 'https://example.test/route-intelligence/availability-fixture',
      rawHash: 'avail-aud-idr',
    });
    expect(item.observationType).toBe('route_availability_observation');
    expect(item.observationType).not.toBe('provider_operational_health');
    expect(item.subjectId).toBe(availabilityObservationSubjectId(AU_ID, 'supplier_payment'));
    expect(item.value.route.offeringId).toBe('wise-international');
  });

  it('does not share identity with a fee observation on the same route', () => {
    const fee = buildProviderFeeObservation({
      route: AU_ID,
      amount: 10000,
      sourceCurrency: 'AUD',
      feeAmount: 37,
      feeCurrency: 'AUD',
      feeModel: 'fixed',
      feePercent: null,
      observedAt: '2026-09-10T13:00:00.000Z',
      fetchedAt: '2026-09-10T14:00:00.000Z',
      sourceId: 'test_fee_fixture',
      sourceUrl: 'https://example.test/route-intelligence/fee-observation',
      rawHash: 'fee-37',
    });
    const avail = buildRouteAvailabilityObservation({
      route: AU_ID,
      status: 'unknown',
      observedAt: '2026-09-10T13:00:00.000Z',
      fetchedAt: '2026-09-10T14:00:00.000Z',
      sourceId: 'phase8_availability_fixture',
      sourceUrl: 'https://example.test/route-intelligence/availability-fixture',
      rawHash: 'avail-unknown',
    });
    expect(fee.subjectId).not.toBe(avail.subjectId);
    expect(fee.observationType).not.toBe(avail.observationType);
  });
});

describe('economic observation persistence', () => {
  it('refreshes unchanged FX and inserts a changed rate', async () => {
    const repo = memoryRepository();
    const first = await persistRouteFxObservation(repo, fx());
    const refresh = await persistRouteFxObservation(
      repo,
      fx({ fetchedAt: '2026-09-10T14:30:00.000Z', rawHash: 'fx-refresh' })
    );
    const changed = await persistRouteFxObservation(
      repo,
      fx({ exchangeRate: 2.75, fetchedAt: '2026-09-10T14:45:00.000Z', rawHash: 'fx-changed' })
    );
    expect(first.action).toBe('inserted');
    expect(refresh.action).toBe('refreshed');
    expect(changed.action).toBe('inserted');
    expect(repo.rows).toHaveLength(2);
  });
});

describe('domestic vs cross-border route identity', () => {
  it('keeps AU→ID and ID→ID subjects distinct', () => {
    expect(routeSubjectKey(AU_ID)).not.toBe(routeSubjectKey(ID_ID));
    expect(fxObservationSubjectId(AU_ID, 10000, 'AUD', 'IDR')).not.toBe(
      fxObservationSubjectId(ID_ID, 10000, 'IDR', 'IDR')
    );
  });
});
