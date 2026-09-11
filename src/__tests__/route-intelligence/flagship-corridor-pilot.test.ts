import fs from 'fs';
import path from 'path';
import {
  compareLandingRoutes,
  DEFAULT_LANDING_SEARCH,
  rankLandingRoutes,
} from '@/lib/journey/landing-route-comparison';
import {
  compareShadowDecision,
  CORRIDOR_CAPABILITY_MATRIX,
  createRouteSubject,
  decideRoute,
  getRouteEconomicState,
  routeSubjectKey,
} from '@/lib/route-intelligence';
import { parseEcbEuroFxObservation } from '@/lib/route-intelligence/ecb-fx-adapter';
import {
  persistRouteFxObservation,
  type ObservationRepository,
  type StoredObservationRow,
} from '@/lib/route-intelligence/observation-store.server';
import {
  createRbaAudFxAdapter,
  parseRbaAudFxObservation,
  RBA_AUD_FX_SOURCE_ID,
  RBA_AUD_FX_SOURCE_URL,
  RBA_AUD_FX_WHAT_THIS_PROVES,
} from '@/lib/route-intelligence/rba-fx-adapter';
import type { DecisionPayment } from '@/lib/route-intelligence/decision-types';
import type { RouteSubject } from '@/lib/route-intelligence/types';

/**
 * Official-source-shaped RBA RSS-CB document.
 * Rates are the official RBA daily publication for 10 Sep 2026
 * (units of foreign currency per AUD). This file is a fixture, not live RSS.
 */
const FIXTURE_PATHS = [
  path.join(process.cwd(), '__tests__/route-intelligence/fixtures/rba-rss-cb-exchange-rates.fixture.xml'),
  path.join(process.cwd(), 'src/__tests__/route-intelligence/fixtures/rba-rss-cb-exchange-rates.fixture.xml'),
];
const RBA_FIXTURE_XML = fs.readFileSync(
  FIXTURE_PATHS.find((candidate) => fs.existsSync(candidate)) ?? FIXTURE_PATHS[0],
  'utf8'
);

const ECB_FIXTURE_PATHS = [
  path.join(process.cwd(), '__tests__/route-intelligence/fixtures/ecb-eurofxref-daily.fixture.xml'),
  path.join(process.cwd(), 'src/__tests__/route-intelligence/fixtures/ecb-eurofxref-daily.fixture.xml'),
];
const ECB_FIXTURE_XML = fs.readFileSync(
  ECB_FIXTURE_PATHS.find((candidate) => fs.existsSync(candidate)) ?? ECB_FIXTURE_PATHS[0],
  'utf8'
);

const FETCHED_AT = new Date('2026-09-11T00:30:00.000Z');
const NOW = new Date('2026-09-11T12:00:00.000Z');
const STALE_NOW = new Date('2026-09-14T00:00:01.000Z');

const FLAGSHIP_QUERY = {
  ...DEFAULT_LANDING_SEARCH,
  originCountry: 'AU' as const,
  destinationCountry: 'ID' as const,
  amount: 10000,
  currency: 'AUD',
  destinationCurrency: 'IDR',
  transactionType: 'supplier_payment' as const,
  priority: 'lowest_cost' as const,
};

function flagshipRoute(input: {
  providerId: RouteSubject['providerId'];
  offeringId: string;
  mechanismId: RouteSubject['mechanismId'];
  rail?: string;
}): RouteSubject {
  return createRouteSubject({
    providerId: input.providerId,
    offeringId: input.offeringId,
    mechanismId: input.mechanismId,
    corridor: { origin: 'AU', destination: 'ID' },
    sourceCurrency: 'AUD',
    destinationCurrency: 'IDR',
    networkRail: input.rail ?? 'unknown',
  });
}

const WISE_AU_ID = flagshipRoute({
  providerId: 'wise',
  offeringId: 'wise-international',
  mechanismId: 'international_bank',
});
const OFX_AU_ID = flagshipRoute({
  providerId: 'ofx',
  offeringId: 'ofx-international',
  mechanismId: 'international_bank',
});
const BANK_AU_ID = flagshipRoute({
  providerId: 'bank',
  offeringId: 'bank-swift',
  mechanismId: 'international_bank',
});

function payment(): DecisionPayment {
  return {
    origin: 'AU',
    destination: 'ID',
    sourceCurrency: 'AUD',
    destinationCurrency: 'IDR',
    amount: 10000,
    transactionType: 'supplier_payment',
    priority: 'lowest_cost',
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

describe('flagship AU→ID / AUD→IDR corridor evidence', () => {
  it('parses official-source-shaped RBA AUD→IDR reference FX', () => {
    const result = parseRbaAudFxObservation(RBA_FIXTURE_XML, WISE_AU_ID, FETCHED_AT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.observation.value.sourceCurrency).toBe('AUD');
    expect(result.observation.value.destinationCurrency).toBe('IDR');
    expect(result.observation.value.exchangeRate).toBe(12655);
    expect(result.observation.value.rateKind).toBe('mid_market_reference');
    expect(result.observation.provenance).toBe('externally_sourced');
    expect(result.observation.sourceId).toBe(RBA_AUD_FX_SOURCE_ID);
    expect(result.observation.sourceUrl).toBe(RBA_AUD_FX_SOURCE_URL);
    expect(result.observation.observedAt).toBe('2026-09-10T00:00:00.000Z');
    expect(result.observation.fetchedAt).toBe(FETCHED_AT.toISOString());
    expect(RBA_AUD_FX_WHAT_THIS_PROVES.join(' ')).toContain('not a provider executable customer quote');
  });

  it('keeps flagship RouteSubject identity and does not invent a rail', () => {
    const result = parseRbaAudFxObservation(RBA_FIXTURE_XML, WISE_AU_ID, FETCHED_AT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.observation.value.route.corridor).toEqual({ origin: 'AU', destination: 'ID' });
    expect(result.observation.value.route.currencyPair).toEqual({ source: 'AUD', target: 'IDR' });
    expect(result.observation.value.route.networkRail).toBe('unknown');
    expect(routeSubjectKey(result.observation.value.route)).toBe(routeSubjectKey(WISE_AU_ID));
  });

  it('attaches the same official reference rate to Wise and OFX without implying a provider quote', async () => {
    const adapter = createRbaAudFxAdapter();
    const wise = adapter.readFx?.({ route: WISE_AU_ID, payload: RBA_FIXTURE_XML, now: FETCHED_AT });
    const ofx = adapter.readFx?.({ route: OFX_AU_ID, payload: RBA_FIXTURE_XML, now: FETCHED_AT });
    expect(wise?.value.exchangeRate).toBe(12655);
    expect(ofx?.value.exchangeRate).toBe(12655);
    expect(wise?.providerId).toBe('wise');
    expect(ofx?.providerId).toBe('ofx');
    expect(wise?.value.rateKind).toBe('mid_market_reference');
    expect(wise?.subjectId).not.toBe(ofx?.subjectId);
  });

  it('stores fee, FX, settlement, and availability as distinct economic dimensions', () => {
    const fx = parseRbaAudFxObservation(RBA_FIXTURE_XML, WISE_AU_ID, FETCHED_AT);
    expect(fx.ok).toBe(true);
    if (!fx.ok) return;
    const state = getRouteEconomicState(WISE_AU_ID, { fxObservations: [fx.observation] }, { now: NOW });
    expect(state.fx.state).toBe('known');
    expect(state.fee.state).toBe('unavailable');
    expect(state.settlement.state).toBe('unavailable');
    expect(state.availability.state).toBe('unavailable');
    expect(state.fx.observation?.value.rateKind).toBe('mid_market_reference');
  });

  it('keeps stale RBA FX stale and unknown dimensions unknown', () => {
    const fx = parseRbaAudFxObservation(RBA_FIXTURE_XML, WISE_AU_ID, FETCHED_AT);
    expect(fx.ok).toBe(true);
    if (!fx.ok) return;
    const stale = getRouteEconomicState(WISE_AU_ID, { fxObservations: [fx.observation] }, { now: STALE_NOW });
    expect(stale.fx.state).toBe('stale');
    expect(stale.fee.state).toBe('unavailable');
    const missing = getRouteEconomicState(BANK_AU_ID, { fxObservations: [fx.observation] }, { now: NOW });
    expect(missing.fx.state).toBe('unavailable');
  });

  it('does not triangulate ECB EUR crosses into AUD→IDR', () => {
    expect(parseRbaAudFxObservation(RBA_FIXTURE_XML, createRouteSubject({
      providerId: 'wise',
      offeringId: 'wise-international',
      mechanismId: 'international_bank',
      corridor: { origin: 'DE', destination: 'ID' },
      sourceCurrency: 'EUR',
      destinationCurrency: 'IDR',
      networkRail: 'unknown',
    }), FETCHED_AT)).toEqual({ ok: false, reason: 'currency_mismatch' });
    expect(parseEcbEuroFxObservation(ECB_FIXTURE_XML, WISE_AU_ID, FETCHED_AT)).toEqual({
      ok: false,
      reason: 'currency_mismatch',
    });
    const rba = parseRbaAudFxObservation(RBA_FIXTURE_XML, WISE_AU_ID, FETCHED_AT);
    expect(rba.ok).toBe(true);
    if (!rba.ok) return;
    expect(rba.observation.value.exchangeRate).toBe(12655);
    expect(rba.observation.value.exchangeRate).not.toBe(20414.13);
  });

  it('fails closed on a malformed RBA document and an unpublished currency', () => {
    expect(parseRbaAudFxObservation('<not-rba/>', WISE_AU_ID, FETCHED_AT)).toEqual({
      ok: false,
      reason: 'malformed',
    });
    const noIdr = RBA_FIXTURE_XML.replace(/<item rdf:about="https:\/\/www\.rba\.gov\.au\/statistics\/frequency\/exchange-rates.html#IDR">[\s\S]*?<\/item>/, '');
    expect(parseRbaAudFxObservation(noIdr, WISE_AU_ID, FETCHED_AT)).toEqual({
      ok: false,
      reason: 'missing_rate',
    });
  });

  it('does not infer a network rail from the provider', () => {
    const wise = parseRbaAudFxObservation(RBA_FIXTURE_XML, WISE_AU_ID, FETCHED_AT);
    const ofx = parseRbaAudFxObservation(RBA_FIXTURE_XML, OFX_AU_ID, FETCHED_AT);
    expect(wise.ok && ofx.ok).toBe(true);
    if (!wise.ok || !ofx.ok) return;
    expect(wise.observation.value.route.networkRail).toBe('unknown');
    expect(ofx.observation.value.route.networkRail).toBe('unknown');
    expect(wise.observation.value.route.networkRail).not.toBe('swift');
  });
});

describe('flagship decision and public ranking isolation', () => {
  it('feeds RBA FX into decideRoute without inventing fees or a winner', async () => {
    const wiseFx = parseRbaAudFxObservation(RBA_FIXTURE_XML, WISE_AU_ID, FETCHED_AT);
    const ofxFx = parseRbaAudFxObservation(RBA_FIXTURE_XML, OFX_AU_ID, FETCHED_AT);
    expect(wiseFx.ok && ofxFx.ok).toBe(true);
    if (!wiseFx.ok || !ofxFx.ok) return;
    const repo = memoryRepository();
    await persistRouteFxObservation(repo, wiseFx.observation);
    await persistRouteFxObservation(repo, ofxFx.observation);
    expect(repo.rows).toHaveLength(2);

    const decision = decideRoute(payment(), [{ route: WISE_AU_ID }, { route: OFX_AU_ID }, { route: BANK_AU_ID }], {
      capabilities: CORRIDOR_CAPABILITY_MATRIX,
      fxObservations: [wiseFx.observation, ofxFx.observation],
      now: NOW,
    });
    expect(decision.mode).toBe('shadow');
    const wise = [decision.recommended, ...decision.alternatives].find(
      (item) => item?.route.offeringId === 'wise-international'
    );
    expect(wise?.economic.fx.state).toBe('known');
    expect(wise?.economic.fee.state).toBe('unavailable');
    expect(wise?.totalCost.state).toBe('unknown');
    expect(wise?.unknowns.some((item) => item.startsWith('explicit_fee:'))).toBe(true);
    expect(decision.confidence.level).not.toBe('high');
  });

  it('keeps the public AU→ID ranking unchanged and does not pretend the flagship case is solved', () => {
    const publicResult = compareLandingRoutes(FLAGSHIP_QUERY);
    expect(publicResult.recommendedOffering.id).toBe('wise-international');
    expect(rankLandingRoutes(FLAGSHIP_QUERY)[0]?.id).toBe('international_bank');

    const wiseFx = parseRbaAudFxObservation(RBA_FIXTURE_XML, WISE_AU_ID, FETCHED_AT);
    const ofxFx = parseRbaAudFxObservation(RBA_FIXTURE_XML, OFX_AU_ID, FETCHED_AT);
    expect(wiseFx.ok && ofxFx.ok).toBe(true);
    if (!wiseFx.ok || !ofxFx.ok) return;

    const fetchSpy = jest.spyOn(global, 'fetch');
    const after = compareLandingRoutes(FLAGSHIP_QUERY);
    expect(after.offerings.map((item) => item.id)).toEqual(publicResult.offerings.map((item) => item.id));
    expect(after.recommendedOffering.id).toBe('wise-international');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();

    const decision = decideRoute(
      payment(),
      publicResult.offerings.map((item) => ({
        route: createRouteSubject({
          providerId: item.offering.providerId,
          offeringId: item.offering.id,
          mechanismId: item.offering.mechanism,
          corridor: { origin: 'AU', destination: 'ID' },
          sourceCurrency: 'AUD',
          destinationCurrency: 'IDR',
          networkRail: 'unknown',
        }),
      })),
      {
        capabilities: CORRIDOR_CAPABILITY_MATRIX,
        fxObservations: [wiseFx.observation, ofxFx.observation],
        now: NOW,
      }
    );
    const shadow = compareShadowDecision(
      {
        recommendedOfferingId: publicResult.recommendedOffering.id,
        orderedOfferingIds: publicResult.offerings.map((item) => item.id),
      },
      decision
    );
    expect(typeof shadow.sameRecommendation).toBe('boolean');
    expect(decision.mode).toBe('shadow');
    expect(decision.confidence.level).not.toBe('high');
    expect(
      [decision.recommended, ...decision.alternatives].every(
        (item) => !item || item.economic.fee.state === 'unavailable' || item.totalCost.state === 'unknown'
      )
    ).toBe(true);
  });
});

describe('flagship source and ranking isolation', () => {
  it('is not imported by ranking, eligibility, or homepage comparison', () => {
    const files = [
      path.join(process.cwd(), 'lib/journey/landing-route-rank.ts'),
      path.join(process.cwd(), 'lib/journey/landing-route-comparison.ts'),
      path.join(process.cwd(), 'lib/route-intelligence/route-eligibility.ts'),
      path.join(process.cwd(), 'lib/route-intelligence/index.ts'),
    ];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toContain('rba-fx-adapter');
      expect(source).not.toContain('observeRbaAudFx');
    }
  });
});
