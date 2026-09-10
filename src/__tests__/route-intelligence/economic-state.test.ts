import { compareLandingRoutes, DEFAULT_LANDING_SEARCH, rankLandingRoutes } from '@/lib/journey/landing-route-comparison';
import {
  buildProviderFeeObservation,
  buildRouteAvailabilityObservation,
  buildRouteFxObservation,
  buildRouteSettlementObservation,
  calculateTotalCost,
  createFixtureEconomicAdapter,
  createRouteSubject,
  evaluateEconomicConfidence,
  getPublicRouteIntelligenceSnapshot,
  getRouteEconomicState,
  routeSubjectKey,
} from '@/lib/route-intelligence';
import type { RouteSubject } from '@/lib/route-intelligence/types';
import fs from 'fs';
import path from 'path';

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

function fee(overrides: Partial<Parameters<typeof buildProviderFeeObservation>[0]> = {}) {
  return buildProviderFeeObservation({
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
    ...overrides,
  });
}

function fx(overrides: Partial<Parameters<typeof buildRouteFxObservation>[0]> = {}) {
  return buildRouteFxObservation({
    route: AU_ID,
    sourceCurrency: 'AUD',
    destinationCurrency: 'IDR',
    sourceAmount: 10000,
    destinationAmount: 24907.5,
    exchangeRate: 2.5,
    rateKind: 'mid_market_reference',
    rateSource: 'phase8_fx_fixture',
    includesSpread: false,
    observedAt: '2026-09-10T13:00:00.000Z',
    fetchedAt: '2026-09-10T14:00:00.000Z',
    sourceId: 'phase8_fx_fixture',
    sourceUrl: 'https://example.test/route-intelligence/fx-fixture',
    rawHash: 'fx-2.5',
    ...overrides,
  });
}

function settlement(route: RouteSubject = AU_ID) {
  return buildRouteSettlementObservation({
    route,
    band: 'unknown',
    settlementModel: 'phase8_settlement_fixture',
    observedAt: '2026-09-10T13:00:00.000Z',
    fetchedAt: '2026-09-10T14:00:00.000Z',
    sourceId: 'phase8_settlement_fixture',
    sourceUrl: 'https://example.test/route-intelligence/settlement-fixture',
    rawHash: 'settlement-unknown',
  });
}

function availability(route: RouteSubject = AU_ID, status: 'available' | 'unknown' = 'available') {
  return buildRouteAvailabilityObservation({
    route,
    status,
    reason: 'phase8_availability_fixture',
    paymentType: 'supplier_payment',
    observedAt: '2026-09-10T13:00:00.000Z',
    fetchedAt: '2026-09-10T14:00:00.000Z',
    sourceId: 'phase8_availability_fixture',
    sourceUrl: 'https://example.test/route-intelligence/availability-fixture',
    rawHash: `avail-${status}`,
  });
}

describe('economic state aggregation', () => {
  it('keeps known, unknown, stale, and unavailable distinct', () => {
    const state = getRouteEconomicState(
      AU_ID,
      {
        feeObservations: [fee()],
        fxObservations: [fx({ fetchedAt: '2026-09-10T10:00:00.000Z' })],
        availabilityObservations: [availability()],
      },
      { now: NOW, amount: 10000, paymentType: 'supplier_payment' }
    );
    expect(state.fee.state).toBe('known');
    expect(state.fx.state).toBe('stale');
    expect(state.settlement.state).toBe('unavailable');
    expect(state.availability.state).toBe('known');
    expect(state.settlement.state).not.toBe('known');
    expect(state.fx.state).not.toBe('known');
  });

  it('returns unavailable for every dimension when evidence is missing', () => {
    const state = getRouteEconomicState(AU_ID, {}, { now: NOW, amount: 10000 });
    expect(state.fee.state).toBe('unavailable');
    expect(state.fx.state).toBe('unavailable');
    expect(state.settlement.state).toBe('unavailable');
    expect(state.availability.state).toBe('unavailable');
    expect(state.confidence.level).toBe('unavailable');
  });

  it('matches fees by RouteSubject and amount dimension', () => {
    const ten = fee({ amount: 10000 });
    const hundred = fee({ amount: 100000, feeAmount: 91, rawHash: 'fee-91' });
    const tenState = getRouteEconomicState(
      AU_ID,
      { feeObservations: [ten, hundred] },
      { now: NOW, amount: 10000 }
    );
    const hundredState = getRouteEconomicState(
      AU_ID,
      { feeObservations: [ten, hundred] },
      { now: NOW, amount: 100000 }
    );
    expect(tenState.fee.observation?.value.feeAmount).toBe(37);
    expect(hundredState.fee.observation?.value.feeAmount).toBe(91);
    expect(routeSubjectKey(ten.value.route)).toBe(routeSubjectKey(hundred.value.route));
  });

  it('allows a percentage fee with amount=null to apply across amounts', () => {
    const percent = fee({
      amount: null,
      feeAmount: null,
      feeModel: 'percentage',
      feePercent: 0.4,
      rawHash: 'fee-percent',
    });
    const state = getRouteEconomicState(
      AU_ID,
      { feeObservations: [percent] },
      { now: NOW, amount: 25000 }
    );
    expect(state.fee.state).toBe('known');
    expect(state.fee.observation?.value.feePercent).toBe(0.4);
  });
});

describe('economic confidence', () => {
  it('does not grant high confidence merely because some data exists', () => {
    const partial = getRouteEconomicState(
      AU_ID,
      { feeObservations: [fee()] },
      { now: NOW, amount: 10000 }
    );
    expect(partial.fee.state).toBe('known');
    expect(partial.confidence.level).not.toBe('high');
    expect(evaluateEconomicConfidence(partial).level).toBe('low');
  });

  it('caps confidence when the network rail is unknown', () => {
    const state = getRouteEconomicState(
      AU_ID,
      {
        feeObservations: [fee()],
        fxObservations: [fx()],
        settlementObservations: [settlement()],
        availabilityObservations: [availability()],
      },
      { now: NOW, amount: 10000, paymentType: 'supplier_payment' }
    );
    expect(state.fee.state).toBe('known');
    expect(state.fx.state).toBe('known');
    expect(state.settlement.state).toBe('known');
    expect(state.availability.state).toBe('known');
    expect(state.confidence.level).toBe('moderate');
    expect(state.confidence.reasons).toContain('unknown_network_rail');
  });
});

describe('total-cost calculation', () => {
  it('computes a fixture AU→ID total without inventing live provider numbers', () => {
    const state = getRouteEconomicState(
      AU_ID,
      { feeObservations: [fee()], fxObservations: [fx()] },
      { now: NOW, amount: 10000 }
    );
    const cost = calculateTotalCost(state);
    expect(cost).toEqual({
      state: 'known',
      sourceAmount: 10000,
      sourceCurrency: 'AUD',
      explicitFeeAmount: 37,
      explicitFeeCurrency: 'AUD',
      destinationAmount: (10000 - 37) * 2.5,
      destinationCurrency: 'IDR',
      effectiveRate: ((10000 - 37) * 2.5) / 10000,
      method: 'source_fee_then_convert',
    });
  });

  it('refuses to double-count FX spread and a percentage markup', () => {
    const state = getRouteEconomicState(
      AU_ID,
      {
        feeObservations: [
          fee({
            feeModel: 'percentage',
            feeAmount: null,
            feePercent: 0.4,
            rawHash: 'fee-percent-spread',
          }),
        ],
        fxObservations: [fx({ rateKind: 'provider_quoted', includesSpread: true })],
      },
      { now: NOW, amount: 10000 }
    );
    expect(calculateTotalCost(state)).toEqual({ state: 'unknown', reason: 'double_count_risk' });
  });

  it('returns unknown when FX is stale rather than using it as current', () => {
    const state = getRouteEconomicState(
      AU_ID,
      {
        feeObservations: [fee()],
        fxObservations: [fx({ fetchedAt: '2026-09-10T10:00:00.000Z' })],
      },
      { now: NOW, amount: 10000 }
    );
    expect(calculateTotalCost(state)).toEqual({ state: 'unknown', reason: 'stale_fx' });
  });

  it('returns unknown for indicative FX', () => {
    const state = getRouteEconomicState(
      AU_ID,
      { feeObservations: [fee()], fxObservations: [fx({ rateKind: 'indicative' })] },
      { now: NOW, amount: 10000 }
    );
    expect(calculateTotalCost(state)).toEqual({ state: 'unknown', reason: 'indicative_fx' });
  });

  it('computes a domestic IDR net without requiring FX', () => {
    const domesticFee = fee({
      route: ID_ID,
      sourceCurrency: 'IDR',
      feeCurrency: 'IDR',
      feeAmount: 2500,
      rawHash: 'fee-idr-2500',
    });
    const state = getRouteEconomicState(
      ID_ID,
      { feeObservations: [domesticFee] },
      { now: NOW, amount: 10000 }
    );
    expect(calculateTotalCost(state)).toEqual({
      state: 'known',
      sourceAmount: 10000,
      sourceCurrency: 'IDR',
      explicitFeeAmount: 2500,
      explicitFeeCurrency: 'IDR',
      destinationAmount: 7500,
      destinationCurrency: 'IDR',
      effectiveRate: 1,
      method: 'same_currency_net',
    });
  });
});

describe('representative goldens', () => {
  it('AU → ID AUD → IDR supplier payment keeps partial evidence explicit', () => {
    const state = getRouteEconomicState(
      AU_ID,
      {
        feeObservations: [fee()],
        fxObservations: [fx()],
        availabilityObservations: [availability(AU_ID, 'available')],
      },
      { now: NOW, amount: 10000, paymentType: 'supplier_payment' }
    );
    expect(state.route.corridor).toEqual({ origin: 'AU', destination: 'ID' });
    expect(state.fee.state).toBe('known');
    expect(state.fx.state).toBe('known');
    expect(state.settlement.state).toBe('unavailable');
    expect(state.availability.state).toBe('known');
    expect(state.confidence.level).not.toBe('high');
  });

  it('ID → ID IDR → IDR supplier payment does not invent settlement speed', () => {
    const state = getRouteEconomicState(
      ID_ID,
      {
        feeObservations: [
          fee({
            route: ID_ID,
            sourceCurrency: 'IDR',
            feeCurrency: 'IDR',
            feeAmount: 2500,
            rawHash: 'fee-idr',
          }),
        ],
        availabilityObservations: [availability(ID_ID)],
      },
      { now: NOW, amount: 10000, paymentType: 'supplier_payment' }
    );
    expect(state.route.corridor).toEqual({ origin: 'ID', destination: 'ID' });
    expect(state.fx.state).toBe('unavailable');
    expect(state.settlement.state).toBe('unavailable');
    expect(state.settlement.state).not.toBe('known');
  });
});

describe('source adapter boundary', () => {
  it('exposes a fixture adapter that does not fetch', () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const adapter = createFixtureEconomicAdapter({
      fees: [fee()],
      fx: [fx()],
      settlements: [],
      availability: [],
    });
    expect(adapter.sourceId).toBe('phase8_fixture_adapter');
    expect(adapter.readFee?.({ route: AU_ID })?.value.feeAmount).toBe(37);
    expect(adapter.readFx?.({ route: AU_ID })?.value.exchangeRate).toBe(2.5);
    expect(adapter.readSettlement?.({ route: AU_ID })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('snapshot and public behaviour', () => {
  it('leaves economic fields empty on the public snapshot', () => {
    const snapshot = getPublicRouteIntelligenceSnapshot();
    expect(snapshot.fxObservations).toEqual([]);
    expect(snapshot.settlementObservations).toEqual([]);
    expect(snapshot.availabilityObservations).toEqual([]);
    expect(snapshot.economicStates).toEqual([]);
  });

  it('aggregates supplied observations in shadow mode only', () => {
    const snapshot = getPublicRouteIntelligenceSnapshot({
      evaluateRouteSubjects: [AU_ID],
      feeObservations: [fee()],
      fxObservations: [fx()],
      economicAmount: 10000,
      now: NOW,
    });
    expect(snapshot.economicStates).toHaveLength(1);
    expect(snapshot.economicStates[0]?.fee.state).toBe('known');
    expect(snapshot.eligibilityDecisions).toEqual([]);
  });

  it('does not change ranking or public comparison', () => {
    const query = {
      ...DEFAULT_LANDING_SEARCH,
      originCountry: 'AU' as const,
      destinationCountry: 'ID' as const,
      transactionType: 'supplier_payment' as const,
      priority: 'lowest_cost' as const,
    };
    expect(rankLandingRoutes(query)[0]?.id).toBe('international_bank');
    const baseline = compareLandingRoutes(query);
    const injected = compareLandingRoutes(query, {
      feeObservations: [fee()],
      fxObservations: [fx()],
      evaluateRouteSubjects: [AU_ID],
      economicAmount: 10000,
      now: NOW,
    });
    expect(injected.offerings.map((item) => item.id)).toEqual(baseline.offerings.map((item) => item.id));
    expect(injected.recommendedOffering.offering.id).toBe('wise-international');
    const fetchSpy = jest.spyOn(global, 'fetch');
    compareLandingRoutes(DEFAULT_LANDING_SEARCH);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('does not wire economic state into ranking, eligibility, UI, Advisor, execution, or MFA', () => {
    const root = path.join(process.cwd(), 'lib/route-intelligence');
    const rank = fs.readFileSync(path.join(process.cwd(), 'lib/journey/landing-route-rank.ts'), 'utf8');
    expect(rank).not.toContain('getRouteEconomicState');
    expect(rank).not.toContain('calculateTotalCost');
    const sources = fs
      .readdirSync(root)
      .filter((file) => file.endsWith('.ts'))
      .map((file) => fs.readFileSync(path.join(root, file), 'utf8'))
      .join('\n');
    expect(sources).not.toContain('https://api.wise.com');
    expect(sources).not.toContain('@/lib/auth');
    expect(sources).not.toContain('@/lib/payouts');
  });
});
