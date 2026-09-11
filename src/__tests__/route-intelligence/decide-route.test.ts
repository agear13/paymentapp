import { compareLandingRoutes, DEFAULT_LANDING_SEARCH, rankLandingRoutes } from '@/lib/journey/landing-route-comparison';
import { catalogEvidence } from '@/lib/route-intelligence';
import {
  buildProviderFeeObservation,
  buildRailRegulatoryObservation,
  buildRouteAvailabilityObservation,
  buildRouteFxObservation,
  buildRouteSettlementObservation,
  compareShadowDecision,
  CORRIDOR_CAPABILITY_MATRIX,
  createRouteSubject,
  decideRoute,
  decisionPaymentFromSearch,
  evaluateLatestObservation,
  getPublicRouteIntelligenceSnapshot,
  observationStaleAfter,
  WISE_PAYMENTS_COMPONENT_ID,
} from '@/lib/route-intelligence';
import type { DecisionCandidate, DecisionPayment } from '@/lib/route-intelligence/decision-types';
import type {
  ProviderOperationalHealthObservation,
  RouteSubject,
} from '@/lib/route-intelligence/types';
import fs from 'fs';
import path from 'path';

const NOW = new Date('2026-09-10T15:00:00.000Z');

function route(input: {
  providerId: RouteSubject['providerId'];
  offeringId: string;
  mechanismId: RouteSubject['mechanismId'];
  origin: string;
  destination: string;
  source: string;
  target: string;
  rail?: string;
}): RouteSubject {
  return createRouteSubject({
    providerId: input.providerId,
    offeringId: input.offeringId,
    mechanismId: input.mechanismId,
    corridor: { origin: input.origin, destination: input.destination },
    sourceCurrency: input.source,
    destinationCurrency: input.target,
    networkRail: input.rail ?? 'unknown',
  });
}

const WISE_AU_ID = route({
  providerId: 'wise',
  offeringId: 'wise-international',
  mechanismId: 'international_bank',
  origin: 'AU',
  destination: 'ID',
  source: 'AUD',
  target: 'IDR',
});

const OFX_AU_ID = route({
  providerId: 'ofx',
  offeringId: 'ofx-international',
  mechanismId: 'international_bank',
  origin: 'AU',
  destination: 'ID',
  source: 'AUD',
  target: 'IDR',
});

const BANK_AU_ID = route({
  providerId: 'bank',
  offeringId: 'bank-swift',
  mechanismId: 'international_bank',
  origin: 'AU',
  destination: 'ID',
  source: 'AUD',
  target: 'IDR',
});

const BANK_AU_AU = route({
  providerId: 'bank',
  offeringId: 'bank-domestic',
  mechanismId: 'domestic_bank',
  origin: 'AU',
  destination: 'AU',
  source: 'AUD',
  target: 'AUD',
  rail: 'npp',
});

const WISE_AU_TH = route({
  providerId: 'wise',
  offeringId: 'wise-international',
  mechanismId: 'international_bank',
  origin: 'AU',
  destination: 'TH',
  source: 'AUD',
  target: 'THB',
});

const WISE_AU_SG = route({
  providerId: 'wise',
  offeringId: 'wise-international',
  mechanismId: 'international_bank',
  origin: 'AU',
  destination: 'SG',
  source: 'AUD',
  target: 'SGD',
});

const BANK_ID_FAST = route({
  providerId: 'bank',
  offeringId: 'bank-id-fast',
  mechanismId: 'domestic_bank',
  origin: 'ID',
  destination: 'ID',
  source: 'IDR',
  target: 'IDR',
  rail: 'bi_fast',
});

const BANK_ID_SKNBI = route({
  providerId: 'ofx',
  offeringId: 'bank-id-sknbi',
  mechanismId: 'domestic_bank',
  origin: 'ID',
  destination: 'ID',
  source: 'IDR',
  target: 'IDR',
  rail: 'sknbi',
});

function payment(overrides: Partial<DecisionPayment> = {}): DecisionPayment {
  return {
    origin: 'AU',
    destination: 'ID',
    sourceCurrency: 'AUD',
    destinationCurrency: 'IDR',
    amount: 10000,
    transactionType: 'supplier_payment',
    priority: 'lowest_cost',
    ...overrides,
  };
}

function candidates(routes: RouteSubject[]): DecisionCandidate[] {
  return routes.map((item) => ({ route: item }));
}

function fee(subject: RouteSubject, feeAmount: number, fetchedAt = '2026-09-10T14:00:00.000Z') {
  return buildProviderFeeObservation({
    route: subject,
    amount: 10000,
    sourceCurrency: subject.currencyPair.source,
    feeAmount,
    feeCurrency: subject.currencyPair.source,
    feeModel: 'fixed',
    feePercent: null,
    observedAt: '2026-09-10T13:00:00.000Z',
    fetchedAt,
    sourceId: 'phase9_fee_fixture',
    sourceUrl: 'https://example.test/route-intelligence/fee-fixture',
    rawHash: `fee-${subject.offeringId}-${feeAmount}`,
  });
}

function fx(subject: RouteSubject, rate: number, overrides: { fetchedAt?: string; rateKind?: 'mid_market_reference' | 'indicative' | 'provider_quoted' } = {}) {
  return buildRouteFxObservation({
    route: subject,
    sourceCurrency: subject.currencyPair.source,
    destinationCurrency: subject.currencyPair.target,
    sourceAmount: 10000,
    exchangeRate: rate,
    rateKind: overrides.rateKind ?? 'mid_market_reference',
    rateSource: 'phase9_fx_fixture',
    includesSpread: false,
    observedAt: '2026-09-10T13:00:00.000Z',
    fetchedAt: overrides.fetchedAt ?? '2026-09-10T14:00:00.000Z',
    sourceId: 'phase9_fx_fixture',
    sourceUrl: 'https://example.test/route-intelligence/fx-fixture',
    rawHash: `fx-${subject.offeringId}-${rate}`,
  });
}

function settle(subject: RouteSubject, band: 'instant' | 'multi_day' | 'unknown') {
  return buildRouteSettlementObservation({
    route: subject,
    band,
    observedAt: '2026-09-10T13:00:00.000Z',
    fetchedAt: '2026-09-10T14:00:00.000Z',
    sourceId: 'phase9_settlement_fixture',
    sourceUrl: 'https://example.test/route-intelligence/settlement-fixture',
    rawHash: `settle-${subject.offeringId}-${band}`,
  });
}

function avail(subject: RouteSubject) {
  return buildRouteAvailabilityObservation({
    route: subject,
    status: 'available',
    paymentType: 'supplier_payment',
    observedAt: '2026-09-10T13:00:00.000Z',
    fetchedAt: '2026-09-10T14:00:00.000Z',
    sourceId: 'phase9_availability_fixture',
    sourceUrl: 'https://example.test/route-intelligence/availability-fixture',
    rawHash: `avail-${subject.offeringId}`,
  });
}

function health(status: ProviderOperationalHealthObservation['value']['componentStatus']): ProviderOperationalHealthObservation {
  const fetchedAt = '2026-09-10T14:00:00.000Z';
  return {
    observationType: 'provider_operational_health',
    subjectKind: 'provider_component',
    subjectId: 'wise:payments',
    providerId: 'wise',
    value: {
      pageIndicator: status === 'operational' ? 'none' : 'major',
      pageDescription: status === 'operational' ? 'All Systems Operational' : 'Outage',
      componentId: WISE_PAYMENTS_COMPONENT_ID,
      componentName: 'Payments',
      componentStatus: status,
    },
    observedAt: '2026-09-10T13:09:10.107Z',
    fetchedAt,
    sourceId: 'wise_statuspage',
    sourceUrl: 'https://status.wise.com/api/v2/summary.json',
    provenance: 'externally_sourced',
    confidence: 'high',
    staleAfter: observationStaleAfter(fetchedAt).toISOString(),
    rawHash: `health-${status}`,
    rawEvidence: {
      pageUpdatedAt: '2026-09-10T13:09:10.107Z',
      pageIndicator: status === 'operational' ? 'none' : 'major',
      pageDescription: status === 'operational' ? 'All Systems Operational' : 'Outage',
      componentId: WISE_PAYMENTS_COMPONENT_ID,
      componentName: 'Payments',
      componentStatus: status,
    },
  };
}

describe('shadow decision goldens', () => {
  it('AU → ID AUD → IDR supplier payment uses capability evidence without changing public ranking', () => {
    const decision = decideRoute(payment(), candidates([WISE_AU_ID, OFX_AU_ID, BANK_AU_ID]), {
      capabilities: CORRIDOR_CAPABILITY_MATRIX,
      now: NOW,
    });
    expect(decision.mode).toBe('shadow');
    expect(['wise-international', 'ofx-international']).toContain(decision.recommended?.route.offeringId);
    expect(decision.recommended?.coverage.status).toBe('supported');
    expect(decision.recommended?.tradeoffs).toContain('underlying_rail_not_evidenced');
    expect(decision.confidence.level).not.toBe('high');
  });

  it('AU → AU AUD → AUD domestic supplier payment', () => {
    const decision = decideRoute(
      payment({ origin: 'AU', destination: 'AU', destinationCurrency: 'AUD' }),
      candidates([BANK_AU_AU]),
      { now: NOW }
    );
    expect(decision.recommended?.route.offeringId).toBe('bank-domestic');
    expect(decision.recommended?.route.corridor).toEqual({ origin: 'AU', destination: 'AU' });
    expect(decision.recommended?.factors.find((item) => item.kind === 'route_specificity')?.state).toBe('known');
  });

  it('AU → TH AUD → THB', () => {
    const decision = decideRoute(
      payment({ destination: 'TH', destinationCurrency: 'THB' }),
      candidates([WISE_AU_TH]),
      { capabilities: CORRIDOR_CAPABILITY_MATRIX, now: NOW }
    );
    expect(decision.recommended?.route.offeringId).toBe('wise-international');
    expect(decision.recommended?.coverage.status).toBe('supported');
  });

  it('AU → SG AUD → SGD', () => {
    const decision = decideRoute(
      payment({ destination: 'SG', destinationCurrency: 'SGD' }),
      candidates([WISE_AU_SG]),
      { capabilities: CORRIDOR_CAPABILITY_MATRIX, now: NOW }
    );
    expect(decision.recommended?.route.offeringId).toBe('wise-international');
    expect(decision.recommended?.coverage.status).toBe('supported');
  });

  it('ID → ID IDR → IDR domestic payment', () => {
    const decision = decideRoute(
      payment({
        origin: 'ID',
        destination: 'ID',
        sourceCurrency: 'IDR',
        destinationCurrency: 'IDR',
      }),
      candidates([BANK_ID_FAST, BANK_ID_SKNBI]),
      { now: NOW }
    );
    expect(decision.recommended?.route.corridor).toEqual({ origin: 'ID', destination: 'ID' });
    expect(['bank-id-fast', 'bank-id-sknbi']).toContain(decision.recommended?.route.offeringId);
  });

  it('does not recommend a route excluded by a fresh operational outage', () => {
    const decision = decideRoute(payment(), candidates([WISE_AU_ID, OFX_AU_ID]), {
      capabilities: CORRIDOR_CAPABILITY_MATRIX,
      health: evaluateLatestObservation(health('major_outage'), NOW),
      now: NOW,
    });
    expect(decision.recommended?.route.offeringId).toBe('ofx-international');
    expect(decision.alternatives.some((item) => item.route.offeringId === 'wise-international' && !item.recommendable)).toBe(
      true
    );
  });

  it('prefers an unrestricted rail when another rail is regulatorily restricted', () => {
    const decision = decideRoute(
      payment({
        origin: 'ID',
        destination: 'ID',
        sourceCurrency: 'IDR',
        destinationCurrency: 'IDR',
      }),
      candidates([BANK_ID_FAST, BANK_ID_SKNBI]),
      {
        regulatoryObservations: [
          buildRailRegulatoryObservation({
            railId: 'bi_fast',
            jurisdiction: 'ID',
            paymentType: 'supplier_payment',
            currency: 'IDR',
            status: 'prohibited',
            effectiveFrom: '2026-01-01T00:00:00.000Z',
            observedAt: '2026-09-10T13:00:00.000Z',
            fetchedAt: '2026-09-10T14:00:00.000Z',
            sourceId: 'phase9_regulatory_fixture',
            sourceUrl: 'https://example.test/route-intelligence/regulatory-fixture',
            source: 'phase9_regulatory_fixture',
            rawHash: 'reg-bi-fast',
          }),
        ],
        now: NOW,
      }
    );
    expect(decision.recommended?.route.offeringId).toBe('bank-id-sknbi');
    expect(decision.recommended?.regulatory.every((item) => item.status !== 'affected')).toBe(true);
    const restricted = decision.alternatives.find((item) => item.route.offeringId === 'bank-id-fast');
    expect(restricted?.recommendable).toBe(true);
    expect(restricted?.tradeoffs).toContain('regulatory_restriction_on_rail');
  });

  it('treats stale economic evidence as stale, not current', () => {
    const decision = decideRoute(payment(), candidates([WISE_AU_ID]), {
      capabilities: CORRIDOR_CAPABILITY_MATRIX,
      feeObservations: [fee(WISE_AU_ID, 37, '2026-09-10T10:00:00.000Z')],
      fxObservations: [fx(WISE_AU_ID, 2.5, { fetchedAt: '2026-09-10T10:00:00.000Z' })],
      now: NOW,
    });
    expect(decision.recommended?.economic.fee.state).toBe('stale');
    expect(decision.recommended?.economic.fx.state).toBe('stale');
    expect(decision.recommended?.totalCost.state).toBe('unknown');
    expect(decision.confidence.level).toBe('low');
  });

  it('keeps missing FX as an unknown economic outcome', () => {
    const decision = decideRoute(payment(), candidates([WISE_AU_ID]), {
      capabilities: CORRIDOR_CAPABILITY_MATRIX,
      feeObservations: [fee(WISE_AU_ID, 37)],
      now: NOW,
    });
    expect(decision.recommended?.economic.fx.state).toBe('unavailable');
    expect(decision.recommended?.totalCost.state).toBe('unknown');
    expect(decision.recommended?.unknowns.some((item) => item.startsWith('fx_outcome'))).toBe(true);
  });

  it('does not treat indicative-only FX as a known total cost', () => {
    const decision = decideRoute(payment(), candidates([WISE_AU_ID]), {
      capabilities: CORRIDOR_CAPABILITY_MATRIX,
      feeObservations: [fee(WISE_AU_ID, 37)],
      fxObservations: [fx(WISE_AU_ID, 2.5, { rateKind: 'indicative' })],
      now: NOW,
    });
    expect(decision.recommended?.totalCost).toEqual({ state: 'unknown', reason: 'indicative_fx' });
  });

  it('records unknown rail as a trade-off, not an automatic exclusion', () => {
    const decision = decideRoute(payment(), candidates([WISE_AU_ID]), {
      capabilities: CORRIDOR_CAPABILITY_MATRIX,
      now: NOW,
    });
    expect(decision.recommended?.recommendable).toBe(true);
    expect(decision.recommended?.route.networkRail).toBe('unknown');
    expect(decision.recommended?.tradeoffs).toContain('underlying_rail_not_evidenced');
  });

  it('can express high confidence for a fully evidenced route', () => {
    const evidenced = route({
      providerId: 'bank',
      offeringId: 'bank-id-fast',
      mechanismId: 'domestic_bank',
      origin: 'ID',
      destination: 'ID',
      source: 'IDR',
      target: 'IDR',
      rail: 'bi_fast',
    });
    const decision = decideRoute(
      payment({
        origin: 'ID',
        destination: 'ID',
        sourceCurrency: 'IDR',
        destinationCurrency: 'IDR',
      }),
      candidates([evidenced]),
      {
        capabilities: [
          {
            id: 'bank-id-fast-id-idr-supplier',
            offeringId: 'bank-id-fast',
            providerId: 'bank',
            mechanism: 'domestic_bank',
            origin: 'ID',
            destination: 'ID',
            currencyPair: { source: 'IDR', target: 'IDR' },
            transactionType: 'supplier_payment',
            networkRails: ['bi_fast'],
            status: 'supported',
            evidence: catalogEvidence({
              source: 'phase9_capability_fixture',
              sourceUrl: 'https://example.test/route-intelligence/capability-fixture',
              sourceType: 'provider_docs',
              notes: 'Phase 9 fixture capability row — not a live provider claim.',
            }),
          },
        ],
        feeObservations: [fee(evidenced, 2500)],
        settlementObservations: [settle(evidenced, 'instant')],
        availabilityObservations: [avail(evidenced)],
        health: evaluateLatestObservation(health('operational'), NOW),
        now: NOW,
      }
    );
    expect(decision.recommended?.totalCost.state).toBe('known');
    expect(decision.recommended?.economic.settlement.state).toBe('known');
    expect(decision.recommended?.economic.availability.state).toBe('known');
    expect(decision.confidence.level).toBe('high');
  });

  it('keeps economic strength and evidence strength distinguishable', () => {
    const cheapUnknown = WISE_AU_ID;
    const evidenced = route({
      providerId: 'bank',
      offeringId: 'bank-id-cross',
      mechanismId: 'international_bank',
      origin: 'AU',
      destination: 'ID',
      source: 'AUD',
      target: 'IDR',
      rail: 'swift',
    });
    const decision = decideRoute(payment(), candidates([cheapUnknown, evidenced]), {
      capabilities: CORRIDOR_CAPABILITY_MATRIX,
      feeObservations: [fee(cheapUnknown, 37), fee(evidenced, 91)],
      fxObservations: [fx(cheapUnknown, 2.5), fx(evidenced, 2.4)],
      settlementObservations: [settle(evidenced, 'multi_day')],
      availabilityObservations: [avail(evidenced)],
      now: NOW,
    });
    expect(decision.recommended?.route.offeringId).toBe('wise-international');
    expect(decision.recommended?.totalCost.state).toBe('known');
    expect(decision.recommended?.tradeoffs).toContain('underlying_rail_not_evidenced');
    const other = decision.alternatives.find((item) => item.route.offeringId === 'bank-id-cross');
    expect(other?.factors.find((item) => item.kind === 'route_specificity')?.state).toBe('known');
    expect(other?.economic.settlement.state).toBe('known');
  });

  it('lowest-cost prefers the better known destination amount', () => {
    const decision = decideRoute(payment({ priority: 'lowest_cost' }), candidates([WISE_AU_ID, OFX_AU_ID]), {
      feeObservations: [fee(WISE_AU_ID, 37), fee(OFX_AU_ID, 41)],
      fxObservations: [fx(WISE_AU_ID, 2.5), fx(OFX_AU_ID, 2.4)],
      now: NOW,
    });
    expect(decision.recommended?.route.offeringId).toBe('wise-international');
    expect(decision.payment.priority).toBe('lowest_cost');
  });

  it('fastest prefers a known instant settlement band', () => {
    const decision = decideRoute(payment({ priority: 'fastest' }), candidates([WISE_AU_ID, OFX_AU_ID]), {
      feeObservations: [fee(WISE_AU_ID, 37), fee(OFX_AU_ID, 41)],
      fxObservations: [fx(WISE_AU_ID, 2.5), fx(OFX_AU_ID, 2.4)],
      settlementObservations: [settle(WISE_AU_ID, 'multi_day'), settle(OFX_AU_ID, 'instant')],
      now: NOW,
    });
    expect(decision.recommended?.route.offeringId).toBe('ofx-international');
  });

  it('simplest prefers supported capability plus known availability', () => {
    const decision = decideRoute(payment({ priority: 'simplest' }), candidates([WISE_AU_ID, OFX_AU_ID]), {
      capabilities: CORRIDOR_CAPABILITY_MATRIX,
      availabilityObservations: [avail(WISE_AU_ID)],
      now: NOW,
    });
    expect(decision.recommended?.route.offeringId).toBe('wise-international');
    expect(decision.recommended?.coverage.status).toBe('supported');
  });
});

describe('shadow comparison vs existing ranking', () => {
  it('can report same or changed recommendation without touching public comparison', () => {
    const query = {
      ...DEFAULT_LANDING_SEARCH,
      originCountry: 'AU' as const,
      destinationCountry: 'ID' as const,
      destinationCurrency: 'IDR',
      transactionType: 'supplier_payment' as const,
      priority: 'lowest_cost' as const,
    };
    const publicResult = compareLandingRoutes(query);
    const decision = decideRoute(decisionPaymentFromSearch(query), candidates([WISE_AU_ID, OFX_AU_ID, BANK_AU_ID]), {
      capabilities: CORRIDOR_CAPABILITY_MATRIX,
      now: NOW,
    });
    const comparison = compareShadowDecision(
      {
        recommendedOfferingId: publicResult.recommendedOffering.offering.id,
        orderedOfferingIds: publicResult.offerings.map((item) => item.id),
      },
      decision
    );
    expect(comparison.rankingRecommendedOfferingId).toBe('wise-international');
    expect(['wise-international', 'ofx-international']).toContain(comparison.decisionRecommendedOfferingId);
    expect(comparison.insufficientEvidence).toBe(true);
    expect(publicResult.recommendedOffering.offering.id).toBe('wise-international');
  });
});

describe('phase 9 isolation', () => {
  it('does not change public snapshot or ranking files', () => {
    const snapshot = getPublicRouteIntelligenceSnapshot();
    expect(snapshot.kind).toBe('catalog_static');
    const query = {
      ...DEFAULT_LANDING_SEARCH,
      originCountry: 'AU' as const,
      destinationCountry: 'ID' as const,
      transactionType: 'supplier_payment' as const,
      priority: 'lowest_cost' as const,
    };
    expect(rankLandingRoutes(query)[0]?.id).toBe('international_bank');
    expect(compareLandingRoutes(query).recommendedOffering.offering.id).toBe('wise-international');
    const fetchSpy = jest.spyOn(global, 'fetch');
    compareLandingRoutes(query);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    const rank = fs.readFileSync(path.join(process.cwd(), 'lib/journey/landing-route-rank.ts'), 'utf8');
    expect(rank).not.toContain('decideRoute');
    expect(rank).not.toContain('compareShadowDecision');
  });
});
