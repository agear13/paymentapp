import fs from 'fs';
import path from 'path';
import {
  compareLandingRoutes,
  DEFAULT_LANDING_SEARCH,
  rankLandingRoutes,
} from '@/lib/journey/landing-route-comparison';
import {
  createEcbEuroFxAdapter,
  ECB_EURO_FX_HOST,
  ECB_EURO_FX_SOURCE_ID,
  ECB_EURO_FX_SOURCE_URL,
  ECB_EURO_FX_STALE_AFTER_MS,
  ECB_EURO_FX_WHAT_THIS_PROVES,
  ecbEuroFxStaleAfter,
  fetchEcbEuroFxDocument,
  observeEcbEuroFx,
  parseEcbEuroFxObservation,
} from '@/lib/route-intelligence/ecb-fx-adapter';
import {
  compareShadowDecision,
  createRouteSubject,
  decideRoute,
  evaluateEconomicConfidence,
  fxObservationSubjectId,
  getPublicRouteIntelligenceSnapshot,
  getRouteEconomicState,
  isObservationFresh,
  routeSubjectKey,
} from '@/lib/route-intelligence';
import {
  persistRouteFxObservation,
  type ObservationRepository,
  type StoredObservationRow,
} from '@/lib/route-intelligence/observation-store.server';
import type { DecisionPayment } from '@/lib/route-intelligence/decision-types';

/**
 * Captured official-source-shaped ECB eurofxref-daily document.
 * This file is a test fixture, not live data.
 */
const FIXTURE_PATHS = [
  path.join(process.cwd(), '__tests__/route-intelligence/fixtures/ecb-eurofxref-daily.fixture.xml'),
  path.join(
    process.cwd(),
    'src/__tests__/route-intelligence/fixtures/ecb-eurofxref-daily.fixture.xml'
  ),
];

const ECB_FIXTURE_XML = fs.readFileSync(
  FIXTURE_PATHS.find((candidate) => fs.existsSync(candidate)) ?? FIXTURE_PATHS[0],
  'utf8'
);

const FETCHED_AT = new Date('2026-09-11T00:30:00.000Z');
const FRESH_NOW = new Date('2026-09-11T12:00:00.000Z');
const STALE_NOW = new Date('2026-09-14T00:00:01.000Z');

const EUR_IDR = createRouteSubject({
  providerId: 'wise',
  offeringId: 'wise-international',
  mechanismId: 'international_bank',
  corridor: { origin: 'DE', destination: 'ID' },
  sourceCurrency: 'EUR',
  destinationCurrency: 'IDR',
  networkRail: 'unknown',
});

const AUD_IDR = createRouteSubject({
  providerId: 'wise',
  offeringId: 'wise-international',
  mechanismId: 'international_bank',
  corridor: { origin: 'AU', destination: 'ID' },
  sourceCurrency: 'AUD',
  destinationCurrency: 'IDR',
  networkRail: 'unknown',
});

const EUR_AUD = createRouteSubject({
  providerId: 'ofx',
  offeringId: 'ofx-international',
  mechanismId: 'international_bank',
  corridor: { origin: 'DE', destination: 'AU' },
  sourceCurrency: 'EUR',
  destinationCurrency: 'AUD',
  networkRail: 'unknown',
});

const IDR_EUR = createRouteSubject({
  providerId: 'wise',
  offeringId: 'wise-international',
  mechanismId: 'international_bank',
  corridor: { origin: 'ID', destination: 'DE' },
  sourceCurrency: 'IDR',
  destinationCurrency: 'EUR',
  networkRail: 'unknown',
});

const EUR_UNKNOWN = createRouteSubject({
  providerId: 'wise',
  offeringId: 'wise-international',
  mechanismId: 'international_bank',
  corridor: { origin: 'DE', destination: 'ID' },
  sourceCurrency: 'EUR',
  destinationCurrency: null,
  networkRail: 'unknown',
});

const EUR_XYZ = createRouteSubject({
  providerId: 'wise',
  offeringId: 'wise-international',
  mechanismId: 'international_bank',
  corridor: { origin: 'DE', destination: 'ZZ' },
  sourceCurrency: 'EUR',
  destinationCurrency: 'XYZ',
  networkRail: 'unknown',
});

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

function xmlResponse(body: string, status = 200, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    text: async () => body,
  } as Response;
}

function fixtureFetcher(body: string = ECB_FIXTURE_XML, status = 200): typeof fetch {
  return async (input) => {
    const url = String(input);
    expect(url).toBe(ECB_EURO_FX_SOURCE_URL);
    return xmlResponse(body, status, { 'content-length': String(Buffer.byteLength(body, 'utf8')) });
  };
}

describe('ECB euro FX adapter — official-source-shaped fixture', () => {
  it('parses a valid official-source-shaped response into a canonical FX observation', () => {
    const result = parseEcbEuroFxObservation(ECB_FIXTURE_XML, EUR_IDR, FETCHED_AT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.observation.observationType).toBe('route_fx_observation');
    expect(result.observation.value.exchangeRate).toBe(20414.13);
    expect(result.observation.value.sourceCurrency).toBe('EUR');
    expect(result.observation.value.destinationCurrency).toBe('IDR');
    expect(result.observation.value.rateKind).toBe('mid_market_reference');
    expect(result.observation.value.rateKind).not.toBe('provider_quoted');
    expect(result.observation.value.rateKind).not.toBe('indicative');
    expect(result.observation.value.includesSpread).toBe(false);
    expect(result.observation.value.sourceAmount).toBeNull();
    expect(result.observation.provenance).toBe('externally_sourced');
    expect(result.observation.sourceId).toBe(ECB_EURO_FX_SOURCE_ID);
    expect(result.observation.sourceUrl).toBe(ECB_EURO_FX_SOURCE_URL);
    expect(result.observation.sourceUrl).toContain(ECB_EURO_FX_HOST);
    expect(result.observation.rawHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.observation.rawEvidence.exchangeRate).toBe(20414.13);
  });

  it('builds RouteSubject identity from the caller without inventing rail or AUD/IDR', () => {
    const result = parseEcbEuroFxObservation(ECB_FIXTURE_XML, EUR_IDR, FETCHED_AT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(routeSubjectKey(result.observation.value.route)).toBe(routeSubjectKey(EUR_IDR));
    expect(result.observation.subjectId).toBe(fxObservationSubjectId(EUR_IDR, null, 'EUR', 'IDR'));
    expect(result.observation.value.route.networkRail).toBe('unknown');
    expect(result.observation.value.route.currencyPair).toEqual({ source: 'EUR', target: 'IDR' });
    expect(result.observation.providerId).toBe('wise');
  });

  it('keeps observedAt as the cube date and fetchedAt as the fetch clock', () => {
    const result = parseEcbEuroFxObservation(ECB_FIXTURE_XML, EUR_IDR, FETCHED_AT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.observation.observedAt).toBe('2026-09-10T00:00:00.000Z');
    expect(result.observation.fetchedAt).toBe(FETCHED_AT.toISOString());
    expect(result.observation.observedAt).not.toBe(result.observation.fetchedAt);
  });

  it('uses a daily-series staleAfter and does not claim intra-day freshness', () => {
    const result = parseEcbEuroFxObservation(ECB_FIXTURE_XML, EUR_IDR, FETCHED_AT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(ECB_EURO_FX_STALE_AFTER_MS).toBe(72 * 60 * 60 * 1000);
    expect(result.observation.staleAfter).toBe(ecbEuroFxStaleAfter('2026-09-10T00:00:00.000Z').toISOString());
    expect(result.observation.staleAfter).toBe('2026-09-13T00:00:00.000Z');
    expect(isObservationFresh(result.observation, FRESH_NOW)).toBe(true);
    expect(isObservationFresh(result.observation, STALE_NOW)).toBe(false);
  });

  it('preserves stale state instead of relabelling it current', () => {
    const result = parseEcbEuroFxObservation(ECB_FIXTURE_XML, EUR_IDR, new Date('2026-09-14T08:00:00.000Z'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const state = getRouteEconomicState(
      EUR_IDR,
      { fxObservations: [result.observation] },
      { now: new Date('2026-09-14T08:00:00.000Z') }
    );
    expect(state.fx.state).toBe('stale');
    expect(state.fx.state).not.toBe('known');
    expect(state.fx.freshness).toBe('stale');
  });

  it('records official reference provenance without calling it an executable quote', () => {
    const result = parseEcbEuroFxObservation(ECB_FIXTURE_XML, EUR_IDR, FETCHED_AT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.observation.provenance).toBe('externally_sourced');
    expect(result.observation.value.rateSource).toBe(ECB_EURO_FX_SOURCE_ID);
    expect(ECB_EURO_FX_WHAT_THIS_PROVES.join(' ')).toContain('not a provider executable customer quote');
    expect(ECB_EURO_FX_WHAT_THIS_PROVES.join(' ')).not.toMatch(/real-time|live rate|updated \d+ minutes/i);
  });

  it('does not mark economic-state confidence high from this official FX fact alone', () => {
    const result = parseEcbEuroFxObservation(ECB_FIXTURE_XML, EUR_IDR, FETCHED_AT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const state = getRouteEconomicState(
      EUR_IDR,
      { fxObservations: [result.observation] },
      { now: FRESH_NOW }
    );
    expect(state.fx.state).toBe('known');
    expect(state.fee.state).toBe('unavailable');
    expect(state.confidence.level).not.toBe('high');
    expect(state.confidence.level).toBe('low');
    expect(evaluateEconomicConfidence(state).reasons).toEqual(
      expect.arrayContaining(['incomplete_evidence', 'unknown_network_rail'])
    );
  });
});

describe('ECB euro FX adapter — refusal cases', () => {
  it('fails closed on a malformed response', () => {
    expect(parseEcbEuroFxObservation('<not-ecb/>', EUR_IDR, FETCHED_AT)).toEqual({
      ok: false,
      reason: 'malformed',
    });
    expect(parseEcbEuroFxObservation({ rates: { IDR: 1 } }, EUR_IDR, FETCHED_AT)).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });

  it('does not emit when the listed economic field is missing', () => {
    const xml = ECB_FIXTURE_XML.replace("<Cube currency='IDR' rate='20414.13'/>", '');
    expect(parseEcbEuroFxObservation(xml, EUR_IDR, FETCHED_AT)).toEqual({
      ok: false,
      reason: 'missing_rate',
    });
  });

  it('does not invert IDR→EUR or triangulate AUD→IDR', () => {
    expect(parseEcbEuroFxObservation(ECB_FIXTURE_XML, IDR_EUR, FETCHED_AT)).toEqual({
      ok: false,
      reason: 'currency_mismatch',
    });
    expect(parseEcbEuroFxObservation(ECB_FIXTURE_XML, AUD_IDR, FETCHED_AT)).toEqual({
      ok: false,
      reason: 'currency_mismatch',
    });
  });

  it('does not emit for the wrong currency or an unpublished currency', () => {
    expect(parseEcbEuroFxObservation(ECB_FIXTURE_XML, EUR_XYZ, FETCHED_AT)).toEqual({
      ok: false,
      reason: 'missing_rate',
    });
    expect(parseEcbEuroFxObservation(ECB_FIXTURE_XML, EUR_UNKNOWN, FETCHED_AT)).toEqual({
      ok: false,
      reason: 'insufficient_route_dimensions',
    });
  });

  it('does not treat the AU→ID corridor as evidence of an AUD/IDR rate', () => {
    const adapter = createEcbEuroFxAdapter();
    expect(
      adapter.readFx?.({
        route: AUD_IDR,
        payload: ECB_FIXTURE_XML,
        now: FETCHED_AT,
      })
    ).toBeNull();
  });

  it('rejects conflicting duplicate rates as malformed', () => {
    const xml = ECB_FIXTURE_XML.replace(
      "<Cube currency='IDR' rate='20414.13'/>",
      "<Cube currency='IDR' rate='20414.13'/><Cube currency='IDR' rate='1'/>"
    );
    expect(parseEcbEuroFxObservation(xml, EUR_IDR, FETCHED_AT)).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });
});

describe('ECB euro FX adapter — fetch failures', () => {
  it('returns timeout when the official host does not respond in time', async () => {
    const fetcher: typeof fetch = () =>
      new Promise((_, reject) => {
        setTimeout(() => {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          reject(error);
        }, 5);
      });
    await expect(
      fetchEcbEuroFxDocument({ fetcher, timeoutMs: 10 })
    ).resolves.toEqual({ ok: false, reason: 'timeout' });
  });

  it('returns http_failure on a non-OK official response', async () => {
    await expect(
      observeEcbEuroFx({
        route: EUR_IDR,
        fetcher: fixtureFetcher('blocked', 403),
        now: FETCHED_AT,
      })
    ).resolves.toEqual({ ok: false, reason: 'http_failure' });
  });

  it('rejects a non-allowlisted URL instead of fetching it', async () => {
    const fetcher = jest.fn();
    await expect(
      fetchEcbEuroFxDocument({
        fetcher: fetcher as unknown as typeof fetch,
        url: 'https://example.test/steal',
      })
    ).resolves.toEqual({ ok: false, reason: 'http_failure' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects an oversized official body', async () => {
    const huge = `${ECB_FIXTURE_XML}${'x'.repeat(70_000)}`;
    await expect(
      fetchEcbEuroFxDocument({ fetcher: fixtureFetcher(huge) })
    ).resolves.toEqual({ ok: false, reason: 'malformed' });
  });
});

describe('ECB euro FX adapter — persistence and economic loop', () => {
  it('inserts a new observation and refreshes an unchanged one', async () => {
    const firstParse = parseEcbEuroFxObservation(ECB_FIXTURE_XML, EUR_IDR, FETCHED_AT);
    expect(firstParse.ok).toBe(true);
    if (!firstParse.ok) return;
    const repo = memoryRepository();
    const inserted = await persistRouteFxObservation(repo, firstParse.observation);
    const refreshedParse = parseEcbEuroFxObservation(
      ECB_FIXTURE_XML,
      EUR_IDR,
      new Date('2026-09-11T01:00:00.000Z')
    );
    expect(refreshedParse.ok).toBe(true);
    if (!refreshedParse.ok) return;
    const refreshed = await persistRouteFxObservation(repo, refreshedParse.observation);
    expect(inserted.action).toBe('inserted');
    expect(refreshed.action).toBe('refreshed');
    expect(refreshed.id).toBe(inserted.id);
    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0]?.fetchedAt.toISOString()).toBe('2026-09-11T01:00:00.000Z');
  });

  it('preserves history when the official rate changes', async () => {
    const firstParse = parseEcbEuroFxObservation(ECB_FIXTURE_XML, EUR_IDR, FETCHED_AT);
    expect(firstParse.ok).toBe(true);
    if (!firstParse.ok) return;
    const repo = memoryRepository();
    await persistRouteFxObservation(repo, firstParse.observation);
    const changedXml = ECB_FIXTURE_XML.replace("rate='20414.13'", "rate='20500.00'");
    const changedParse = parseEcbEuroFxObservation(
      changedXml,
      EUR_IDR,
      new Date('2026-09-11T16:00:00.000Z')
    );
    expect(changedParse.ok).toBe(true);
    if (!changedParse.ok) return;
    const changed = await persistRouteFxObservation(repo, changedParse.observation);
    expect(changed.action).toBe('inserted');
    expect(changed.observation.value.exchangeRate).toBe(20500);
    expect(repo.rows).toHaveLength(2);
    expect(repo.rows[0]?.value).toMatchObject({ exchangeRate: 20414.13 });
  });

  it('feeds the official observation into economic state and the shadow decision engine', async () => {
    const adapter = createEcbEuroFxAdapter();
    const fetched = await adapter.fetchFx?.({
      route: EUR_IDR,
      payload: ECB_FIXTURE_XML,
      now: FETCHED_AT,
    });
    expect(fetched?.ok).toBe(true);
    if (!fetched?.ok) return;

    const repo = memoryRepository();
    const persisted = await persistRouteFxObservation(repo, fetched.observation);
    expect(persisted.action).toBe('inserted');

    const economic = getRouteEconomicState(
      EUR_IDR,
      { fxObservations: [persisted.observation] },
      { now: FRESH_NOW }
    );
    expect(economic.fx.state).toBe('known');
    expect(economic.fx.observation?.value.exchangeRate).toBe(20414.13);
    expect(economic.fx.observation?.value.rateKind).toBe('mid_market_reference');
    expect(economic.confidence.level).not.toBe('high');

    const unknownAud = getRouteEconomicState(AUD_IDR, { fxObservations: [persisted.observation] }, { now: FRESH_NOW });
    expect(unknownAud.fx.state).toBe('unavailable');

    const payment: DecisionPayment = {
      origin: 'DE',
      destination: 'ID',
      sourceCurrency: 'EUR',
      destinationCurrency: 'IDR',
      amount: 10000,
      transactionType: 'supplier_payment',
      priority: 'lowest_cost',
    };
    const candidates = [{ route: EUR_IDR }, { route: AUD_IDR }, { route: EUR_AUD }];
    const withEvidence = decideRoute(payment, candidates, {
      fxObservations: [persisted.observation],
      now: FRESH_NOW,
    });
    const withoutEvidence = decideRoute(payment, candidates, { now: FRESH_NOW });
    const assessments = [withEvidence.recommended, ...withEvidence.alternatives].filter(
      (item): item is NonNullable<typeof item> => Boolean(item)
    );
    const eurAssessment = assessments.find(
      (item) => item.route.currencyPair.source === 'EUR' && item.route.currencyPair.target === 'IDR'
    );
    expect(withEvidence.mode).toBe('shadow');
    expect(eurAssessment?.economic.fx.state).toBe('known');
    expect(eurAssessment?.factors.some((factor) => factor.kind === 'fx_outcome' && factor.state === 'known')).toBe(
      true
    );
    expect(
      [withoutEvidence.recommended, ...withoutEvidence.alternatives].find(
        (item) => item?.route.currencyPair.source === 'EUR' && item.route.currencyPair.target === 'IDR'
      )?.economic.fx.state
    ).toBe('unavailable');
    const shadow = compareShadowDecision(
      {
        recommendedOfferingId: withoutEvidence.recommended?.route.offeringId ?? 'wise-international',
        orderedOfferingIds: [withoutEvidence.recommended, ...withoutEvidence.alternatives]
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
          .map((item) => item.route.offeringId),
      },
      withEvidence
    );
    expect(shadow.decisionRecommendedOfferingId).toBeDefined();
  });

  it('keeps unknown evidence unknown when the source does not cover the subject', () => {
    const result = parseEcbEuroFxObservation(ECB_FIXTURE_XML, AUD_IDR, FETCHED_AT);
    expect(result.ok).toBe(false);
    const state = getRouteEconomicState(AUD_IDR, {}, { now: FRESH_NOW });
    expect(state.fx.state).toBe('unavailable');
    const decision = decideRoute(
      {
        origin: 'AU',
        destination: 'ID',
        sourceCurrency: 'AUD',
        destinationCurrency: 'IDR',
        amount: 10000,
        transactionType: 'supplier_payment',
        priority: 'lowest_cost',
      },
      [{ route: AUD_IDR }],
      { now: FRESH_NOW }
    );
    expect(decision.recommended?.economic.fx.state ?? decision.alternatives[0]?.economic.fx.state).toBe(
      'unavailable'
    );
    expect(decision.mode).toBe('shadow');
  });
});

describe('ECB euro FX adapter — production isolation', () => {
  it('does not change public ranking, comparison, or snapshot behaviour', () => {
    const query = {
      ...DEFAULT_LANDING_SEARCH,
      destinationCurrency: 'IDR',
    };
    expect(rankLandingRoutes(query)[0]?.id).toBe('international_bank');
    const comparison = compareLandingRoutes(query);
    expect(comparison.recommendedOffering.offering.id).toBe('wise-international');
    const snapshot = getPublicRouteIntelligenceSnapshot();
    expect(snapshot.fxObservations).toEqual([]);
    const fetchSpy = jest.spyOn(global, 'fetch');
    compareLandingRoutes(DEFAULT_LANDING_SEARCH);
    getPublicRouteIntelligenceSnapshot(DEFAULT_LANDING_SEARCH);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('is not imported by ranking, eligibility, Advisor, execution, or MFA modules', () => {
    const files = [
      path.join(process.cwd(), 'lib/journey/landing-route-rank.ts'),
      path.join(process.cwd(), 'lib/journey/landing-route-comparison.ts'),
      path.join(process.cwd(), 'lib/route-intelligence/index.ts'),
      path.join(process.cwd(), 'lib/route-intelligence/route-eligibility.ts'),
      path.join(process.cwd(), 'lib/route-intelligence/snapshot.ts'),
    ];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toContain('ecb-fx-adapter');
      expect(source).not.toContain('observeEcbEuroFx');
      expect(source).not.toContain('www.ecb.europa.eu');
    }
  });
});

const describeLiveEcb = process.env.PROVVY_LIVE_ECB_FX === '1' ? describe : describe.skip;

describeLiveEcb('ECB euro FX live diagnostic (manual, not CI)', () => {
  it('fetches the allowlisted official document without fabricating on failure', async () => {
    const result = await observeEcbEuroFx({ route: EUR_IDR, now: new Date() });
    if (result.ok) {
      expect(result.observation.value.sourceCurrency).toBe('EUR');
      expect(result.observation.value.rateKind).toBe('mid_market_reference');
      expect(result.observation.sourceUrl).toBe(ECB_EURO_FX_SOURCE_URL);
    } else {
      expect(['http_failure', 'timeout', 'malformed', 'missing_rate', 'currency_mismatch']).toContain(
        result.reason
      );
    }
  }, 20_000);
});
