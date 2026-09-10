import { compareLandingRoutes, DEFAULT_LANDING_SEARCH, rankLandingRoutes } from '@/lib/journey/landing-route-comparison';
import {
  buildRailRegulatoryObservation,
  createRouteSubject,
  evaluateRegulatoryRouteImpact,
  evaluateRouteEligibility,
  evaluateRouteImpact,
  getPublicRouteIntelligenceSnapshot,
  observationStaleAfter,
} from '@/lib/route-intelligence';
import type {
  ProviderPaymentIncidentObservation,
  RailRegulatoryObservation,
  RouteSubject,
} from '@/lib/route-intelligence/types';
import fs from 'fs';
import path from 'path';

const NOW = new Date('2026-09-10T15:00:00.000Z');

const PROVIDER_A_BI_FAST: RouteSubject = createRouteSubject({
  providerId: 'bank',
  offeringId: 'provider-a-domestic',
  mechanismId: 'domestic_bank',
  corridor: { origin: 'ID', destination: 'ID' },
  sourceCurrency: 'IDR',
  destinationCurrency: 'IDR',
  networkRail: 'bi_fast',
});

const PROVIDER_B_SKNBI: RouteSubject = createRouteSubject({
  providerId: 'ofx',
  offeringId: 'provider-b-domestic',
  mechanismId: 'domestic_bank',
  corridor: { origin: 'ID', destination: 'ID' },
  sourceCurrency: 'IDR',
  destinationCurrency: 'IDR',
  networkRail: 'sknbi',
});

const PROVIDER_C_UNKNOWN: RouteSubject = createRouteSubject({
  providerId: 'wise',
  offeringId: 'wise-local',
  mechanismId: 'domestic_bank',
  corridor: { origin: 'ID', destination: 'ID' },
  sourceCurrency: 'IDR',
  destinationCurrency: 'IDR',
  networkRail: 'unknown',
});

const PROVIDER_D_BI_FAST: RouteSubject = createRouteSubject({
  providerId: 'airwallex',
  offeringId: 'provider-d-domestic',
  mechanismId: 'domestic_bank',
  corridor: { origin: 'ID', destination: 'ID' },
  sourceCurrency: 'IDR',
  destinationCurrency: 'IDR',
  networkRail: 'bi_fast',
});

const AU_ID_BI_FAST: RouteSubject = createRouteSubject({
  providerId: 'bank',
  offeringId: 'provider-a-xb',
  mechanismId: 'international_bank',
  corridor: { origin: 'AU', destination: 'ID' },
  sourceCurrency: 'AUD',
  destinationCurrency: 'IDR',
  networkRail: 'bi_fast',
});

const AU_ID_UNKNOWN: RouteSubject = createRouteSubject({
  providerId: 'wise',
  offeringId: 'wise-international',
  mechanismId: 'international_bank',
  corridor: { origin: 'AU', destination: 'ID' },
  sourceCurrency: 'AUD',
  destinationCurrency: 'IDR',
  networkRail: 'unknown',
});

function regulatory(overrides: Partial<Parameters<typeof buildRailRegulatoryObservation>[0]> = {}): RailRegulatoryObservation {
  const fetchedAt = overrides.fetchedAt ?? '2026-09-10T14:00:00.000Z';
  return buildRailRegulatoryObservation({
    railId: 'bi_fast',
    jurisdiction: 'ID',
    paymentType: 'supplier_payment',
    currency: 'IDR',
    participantType: null,
    status: 'prohibited',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
    observedAt: '2026-09-10T13:00:00.000Z',
    fetchedAt,
    sourceId: 'test_regulatory_fixture',
    sourceUrl: 'https://example.test/bi/regulatory',
    source: 'Bank Indonesia test fixture',
    rawHash: 'reg-bi-fast-prohibited',
    ...overrides,
  });
}

function wiseIncident(): ProviderPaymentIncidentObservation {
  const fetchedAt = '2026-09-10T14:00:00.000Z';
  return {
    observationType: 'provider_payment_incident',
    subjectKind: 'provider_incident',
    subjectId: 'wise:incident:10dy3hydcfdt',
    providerId: 'wise',
    value: {
      incidentId: '10dy3hydcfdt',
      status: 'investigating',
      impact: 'minor',
      title: 'Delayed AED payments',
      description: 'Some AED payments are delayed.',
      startedAt: '2026-09-10T12:00:00.000Z',
      updatedAt: '2026-09-10T12:30:00.000Z',
      resolvedAt: null,
      affectedComponentIds: ['2jxb8y760wrd'],
      affectedComponentNames: ['Payments'],
      latestUpdateId: 'update-1',
      latestUpdateStatus: 'investigating',
      structuredRoute: null,
      routeRelevance: 'unknown',
    },
    observedAt: '2026-09-10T12:30:00.000Z',
    fetchedAt,
    sourceId: 'wise_statuspage',
    sourceUrl: 'https://status.wise.com/incidents/10dy3hydcfdt',
    provenance: 'externally_sourced',
    confidence: 'high',
    staleAfter: observationStaleAfter(fetchedAt).toISOString(),
    rawHash: 'incident-1',
    rawEvidence: {
      incidentId: '10dy3hydcfdt',
      status: 'investigating',
      impact: 'minor',
      title: 'Delayed AED payments',
      description: 'Some AED payments are delayed.',
      startedAt: '2026-09-10T12:00:00.000Z',
      updatedAt: '2026-09-10T12:30:00.000Z',
      resolvedAt: null,
      affectedComponentIds: ['2jxb8y760wrd'],
      affectedComponentNames: ['Payments'],
      latestUpdateId: 'update-1',
    },
  };
}

describe('regulatory route impact — shadow only', () => {
  it('marks a prohibited Rail X route as affected', () => {
    const result = evaluateRegulatoryRouteImpact(PROVIDER_A_BI_FAST, regulatory(), {
      paymentType: 'supplier_payment',
      now: NOW,
    });
    expect(result.mode).toBe('shadow');
    expect(result.status).toBe('affected');
    expect(result.reason).toBe('regulatory_prohibited');
  });

  it('does not mark a Rail Y route as affected by a Rail X prohibition', () => {
    const result = evaluateRegulatoryRouteImpact(PROVIDER_B_SKNBI, regulatory(), {
      paymentType: 'supplier_payment',
      now: NOW,
    });
    expect(result.status).toBe('not_affected');
    expect(result.reason).toBe('rail_mismatch');
  });

  it('keeps a Wise incident separate from regulatory evaluation', () => {
    const incidentImpact = evaluateRouteImpact(
      {
        offeringId: 'wise-international',
        providerId: 'wise',
        corridor: { origin: 'AU', destination: 'AE' },
        currencyPair: { source: 'AUD', target: 'AED' },
      },
      { incidents: [wiseIncident()], now: NOW }
    );
    expect(incidentImpact.incidents).toHaveLength(1);
    expect(incidentImpact.operationalHealth.observationType).toBe('provider_operational_health');
    const regulatoryResult = evaluateRegulatoryRouteImpact(AU_ID_UNKNOWN, regulatory(), {
      paymentType: 'supplier_payment',
      now: NOW,
    });
    expect(regulatoryResult.observationType).toBe('rail_regulatory_observation');
    expect(regulatoryResult.status).toBe('not_affected');
    expect(regulatoryResult.reason).toBe('unknown_route_rail');
  });

  it('does not affect an unrelated provider on another rail', () => {
    const result = evaluateRegulatoryRouteImpact(PROVIDER_B_SKNBI, regulatory(), {
      paymentType: 'supplier_payment',
      now: NOW,
    });
    expect(result.providerId).toBe('ofx');
    expect(result.status).toBe('not_affected');
  });

  it('returns unknown when regulatory evidence is insufficient', () => {
    expect(
      evaluateRegulatoryRouteImpact(PROVIDER_A_BI_FAST, null, {
        paymentType: 'supplier_payment',
        now: NOW,
      }).status
    ).toBe('unknown');
    const incomplete = regulatory({ railId: 'unknown' });
    expect(
      evaluateRegulatoryRouteImpact(PROVIDER_A_BI_FAST, incomplete, {
        paymentType: 'supplier_payment',
        now: NOW,
      }).status
    ).toBe('unknown');
    const paymentSpecific = regulatory({ paymentType: 'supplier_payment' });
    expect(
      evaluateRegulatoryRouteImpact(PROVIDER_A_BI_FAST, paymentSpecific, { now: NOW }).status
    ).toBe('unknown');
  });

  it('evaluates a domestic Indonesia IDR supplier payment', () => {
    const restricted = regulatory({ status: 'prohibited' });
    const routeA = evaluateRegulatoryRouteImpact(PROVIDER_A_BI_FAST, restricted, {
      paymentType: 'supplier_payment',
      now: NOW,
    });
    const routeB = evaluateRegulatoryRouteImpact(PROVIDER_B_SKNBI, restricted, {
      paymentType: 'supplier_payment',
      now: NOW,
    });
    expect(routeA.status).toBe('affected');
    expect(routeB.status).toBe('not_affected');
    const eligibility = evaluateRouteEligibility(
      {
        offeringId: PROVIDER_A_BI_FAST.offeringId,
        providerId: PROVIDER_A_BI_FAST.providerId,
        corridor: PROVIDER_A_BI_FAST.corridor,
        currencyPair: { source: 'IDR', target: 'IDR' },
      },
      { now: NOW }
    );
    expect(eligibility.status).not.toBe('ineligible');
  });

  it('evaluates a cross-border Australia → Indonesia AUD → IDR route only when mapped to the rail', () => {
    const observation = regulatory({
      railId: 'bi_fast',
      jurisdiction: 'ID',
      paymentType: 'supplier_payment',
    });
    const mapped = evaluateRegulatoryRouteImpact(AU_ID_BI_FAST, observation, {
      paymentType: 'supplier_payment',
      now: NOW,
    });
    const unmapped = evaluateRegulatoryRouteImpact(AU_ID_UNKNOWN, observation, {
      paymentType: 'supplier_payment',
      now: NOW,
    });
    expect(mapped.status).toBe('affected');
    expect(unmapped.status).toBe('not_affected');
    expect(unmapped.reason).toBe('unknown_route_rail');
  });
});

describe('provider-agnostic rail restriction', () => {
  it('can affect multiple providers explicitly mapped to the same rail', () => {
    const observation = regulatory();
    const a = evaluateRegulatoryRouteImpact(PROVIDER_A_BI_FAST, observation, {
      paymentType: 'supplier_payment',
      now: NOW,
    });
    const d = evaluateRegulatoryRouteImpact(PROVIDER_D_BI_FAST, observation, {
      paymentType: 'supplier_payment',
      now: NOW,
    });
    expect(a.providerId).toBe('bank');
    expect(d.providerId).toBe('airwallex');
    expect(a.status).toBe('affected');
    expect(d.status).toBe('affected');
  });

  it('does not affect providers whose route rail is unknown', () => {
    const result = evaluateRegulatoryRouteImpact(PROVIDER_C_UNKNOWN, regulatory(), {
      paymentType: 'supplier_payment',
      now: NOW,
    });
    expect(result.status).toBe('not_affected');
    expect(result.reason).toBe('unknown_route_rail');
  });

  it('does not affect providers mapped to another rail', () => {
    const result = evaluateRegulatoryRouteImpact(PROVIDER_B_SKNBI, regulatory(), {
      paymentType: 'supplier_payment',
      now: NOW,
    });
    expect(result.status).toBe('not_affected');
    expect(result.networkRail).toBe('sknbi');
  });
});

describe('stale regulatory evidence', () => {
  it('becomes unknown rather than permitted or prohibited', () => {
    const stale = regulatory({ fetchedAt: '2026-09-10T10:00:00.000Z', status: 'prohibited' });
    const result = evaluateRegulatoryRouteImpact(PROVIDER_A_BI_FAST, stale, {
      paymentType: 'supplier_payment',
      now: NOW,
    });
    expect(result.freshness).toBe('stale');
    expect(result.status).toBe('unknown');
    expect(result.status).not.toBe('affected');
    expect(result.reason).toBe('stale_observation');
  });
});

describe('snapshot regulatory attach', () => {
  it('leaves regulatory observations and impacts empty on the public snapshot', () => {
    const snapshot = getPublicRouteIntelligenceSnapshot();
    expect(snapshot.regulatoryObservations).toEqual([]);
    expect(snapshot.regulatoryImpacts).toEqual([]);
    expect(snapshot.offeringRailMappings).toEqual([]);
    expect(snapshot.networkRails.length).toBeGreaterThan(0);
    expect(snapshot.railCapabilities.length).toBeGreaterThan(0);
  });

  it('evaluates supplied route subjects in shadow mode only', () => {
    const snapshot = getPublicRouteIntelligenceSnapshot({
      evaluateRouteSubjects: [PROVIDER_A_BI_FAST, PROVIDER_B_SKNBI],
      regulatoryObservations: [regulatory()],
      regulatoryPaymentType: 'supplier_payment',
      now: NOW,
    });
    const a = snapshot.regulatoryImpacts.find((item) => item.offeringId === 'provider-a-domestic');
    const b = snapshot.regulatoryImpacts.find((item) => item.offeringId === 'provider-b-domestic');
    expect(a?.status).toBe('affected');
    expect(b?.status).toBe('not_affected');
    expect(snapshot.eligibilityDecisions).toEqual([]);
  });
});

describe('phase 7 regressions', () => {
  const audIdr = {
    ...DEFAULT_LANDING_SEARCH,
    originCountry: 'AU' as const,
    destinationCountry: 'ID' as const,
    transactionType: 'supplier_payment' as const,
    priority: 'lowest_cost' as const,
  };

  it('does not change ranking goldens', () => {
    const ranked = rankLandingRoutes(audIdr);
    expect(ranked[0]?.id).toBe('international_bank');
    const comparison = compareLandingRoutes(audIdr);
    expect(comparison.recommendedOffering.offering.id).toBe('wise-international');
  });

  it('does not change production eligibility', () => {
    const baseline = compareLandingRoutes(audIdr);
    const withRegulatory = compareLandingRoutes(audIdr, {
      regulatoryObservations: [regulatory()],
      evaluateRouteSubjects: [AU_ID_BI_FAST],
      now: NOW,
    });
    expect(withRegulatory.offerings.map((item) => item.id)).toEqual(baseline.offerings.map((item) => item.id));
    expect(withRegulatory.recommendedOffering.offering.id).toBe(baseline.recommendedOffering.offering.id);
  });

  it('does not fetch a network host during public comparison', () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    compareLandingRoutes(DEFAULT_LANDING_SEARCH);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    const comparison = JSON.stringify(compareLandingRoutes(DEFAULT_LANDING_SEARCH));
    expect(comparison).not.toContain('status.wise.com');
  });

  it('does not add a live provider quote API or change UI / Advisor / execution / MFA', () => {
    const root = path.join(process.cwd(), 'lib/route-intelligence');
    const files = fs.readdirSync(root).filter((file) => file.endsWith('.ts'));
    const sources = files.map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
    expect(sources).not.toContain('https://api.wise.com');
    expect(sources).not.toContain('@/lib/wise');
    expect(sources).not.toContain('@/lib/auth');
    expect(sources).not.toContain('@/lib/payouts');
    expect(sources).not.toContain('rankRoutesV2');
    const journeyRoot = path.join(process.cwd(), 'lib/journey');
    const comparison = fs.readFileSync(path.join(journeyRoot, 'landing-route-rank.ts'), 'utf8');
    expect(comparison).not.toContain('evaluateRegulatoryRouteImpact');
    expect(comparison).not.toContain('rail_regulatory_observation');
  });
});
