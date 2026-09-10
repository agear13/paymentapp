import { compareLandingRoutes, DEFAULT_LANDING_SEARCH, rankLandingRoutes } from '@/lib/journey/landing-route-comparison';
import {
  CORRIDOR_CAPABILITY_MATRIX,
  evaluateLatestObservation,
  evaluateRouteEligibility,
  getPublicRouteIntelligenceSnapshot,
  observationStaleAfter,
  routeIsNotExcluded,
  WISE_API_COMPONENT_ID,
  WISE_PAYMENTS_COMPONENT_ID,
  WISE_WEBSITE_COMPONENT_ID,
} from '@/lib/route-intelligence';
import type {
  ProviderOperationalHealthObservation,
  ProviderPaymentIncidentObservation,
  RouteImpactSubject,
} from '@/lib/route-intelligence/types';
import fs from 'fs';
import path from 'path';

const NOW = new Date('2026-09-10T15:00:00.000Z');

const WISE_IDR: RouteImpactSubject = {
  offeringId: 'wise-international',
  providerId: 'wise',
  corridor: { origin: 'AU', destination: 'ID' },
  currencyPair: { source: 'AUD', target: 'IDR' },
};

const WISE_AED: RouteImpactSubject = {
  offeringId: 'wise-international',
  providerId: 'wise',
  corridor: { origin: 'AU', destination: 'AE' },
  currencyPair: { source: 'AUD', target: 'AED' },
};

const AIRWALLEX_IDR: RouteImpactSubject = {
  offeringId: 'airwallex-international',
  providerId: 'airwallex',
  corridor: { origin: 'AU', destination: 'ID' },
  currencyPair: { source: 'AUD', target: 'IDR' },
};

const AUD_IDR_QUERY = {
  ...DEFAULT_LANDING_SEARCH,
  originCountry: 'AU' as const,
  destinationCountry: 'ID' as const,
  amount: 10000,
  currency: 'AUD',
  destinationCurrency: 'IDR',
  transactionType: 'supplier_payment' as const,
  priority: 'lowest_cost' as const,
};

function health(
  componentStatus: ProviderOperationalHealthObservation['value']['componentStatus'],
  fetchedAt = '2026-09-10T14:00:00.000Z'
): ProviderOperationalHealthObservation {
  return {
    observationType: 'provider_operational_health',
    subjectKind: 'provider_component',
    subjectId: 'wise:payments',
    providerId: 'wise',
    value: {
      pageIndicator: componentStatus === 'operational' ? 'none' : 'major',
      pageDescription: componentStatus === 'operational' ? 'All Systems Operational' : 'Outage',
      componentId: WISE_PAYMENTS_COMPONENT_ID,
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
    rawHash: 'health',
    rawEvidence: {
      pageUpdatedAt: '2026-09-10T13:09:10.107Z',
      pageIndicator: componentStatus === 'operational' ? 'none' : 'major',
      pageDescription: componentStatus === 'operational' ? 'All Systems Operational' : 'Outage',
      componentId: WISE_PAYMENTS_COMPONENT_ID,
      componentName: 'Payments',
      componentStatus,
    },
  };
}

function incident(overrides: Partial<ProviderPaymentIncidentObservation> = {}): ProviderPaymentIncidentObservation {
  const fetchedAt = overrides.fetchedAt ?? '2026-09-10T14:00:00.000Z';
  const base: ProviderPaymentIncidentObservation = {
    observationType: 'provider_payment_incident',
    subjectKind: 'provider_incident',
    subjectId: 'wise:incident:10dy3hydcfdt',
    providerId: 'wise',
    value: {
      incidentId: '10dy3hydcfdt',
      status: 'identified',
      impact: 'minor',
      title: 'Delayed AED payments',
      description: 'Customers will continue to see some delays impacting AED transfers.',
      startedAt: '2026-08-24T10:05:30.884Z',
      updatedAt: '2026-09-07T13:57:43.665Z',
      resolvedAt: null,
      affectedComponentIds: [WISE_PAYMENTS_COMPONENT_ID, WISE_API_COMPONENT_ID],
      affectedComponentNames: ['Payments', 'API'],
      latestUpdateId: 'rhl4xn17l6lj',
      latestUpdateStatus: 'identified',
      routeRelevance: 'unknown',
      structuredRoute: null,
    },
    observedAt: '2026-09-07T13:57:43.665Z',
    fetchedAt,
    sourceId: 'wise_statuspage',
    sourceUrl: 'https://status.wise.com/incidents/10dy3hydcfdt',
    provenance: 'externally_sourced',
    confidence: 'high',
    staleAfter: observationStaleAfter(fetchedAt).toISOString(),
    rawHash: 'incident',
    rawEvidence: {
      incidentId: '10dy3hydcfdt',
      status: 'identified',
      impact: 'minor',
      title: 'Delayed AED payments',
      description: 'Customers will continue to see some delays impacting AED transfers.',
      startedAt: '2026-08-24T10:05:30.884Z',
      updatedAt: '2026-09-07T13:57:43.665Z',
      resolvedAt: null,
      affectedComponentIds: [WISE_PAYMENTS_COMPONENT_ID, WISE_API_COMPONENT_ID],
      affectedComponentNames: ['Payments', 'API'],
      latestUpdateId: 'rhl4xn17l6lj',
    },
  };
  return {
    ...base,
    ...overrides,
    value: { ...base.value, ...overrides.value },
  };
}

function structuredAedMajor(): ProviderPaymentIncidentObservation {
  return incident({
    value: {
      ...incident().value,
      impact: 'major',
      title: 'AED payment outage',
      structuredRoute: { destinationCurrency: 'AED' },
    },
  });
}

describe('route operational eligibility', () => {
  it('keeps Wise eligible when Payments is operational', () => {
    const decision = evaluateRouteEligibility(WISE_IDR, { health: health('operational'), now: NOW });
    expect(decision.status).toBe('eligible');
    expect(decision.reasons).toEqual(['no_material_failure']);
    expect(routeIsNotExcluded(decision)).toBe(true);
  });

  it('keeps Wise eligible when Payments is degraded_performance', () => {
    const decision = evaluateRouteEligibility(WISE_IDR, {
      health: health('degraded_performance'),
      now: NOW,
    });
    expect(decision.status).toBe('eligible');
    expect(decision.reasons).toEqual(['degraded_performance_not_excluded']);
    expect(routeIsNotExcluded(decision)).toBe(true);
  });

  it('marks Wise ineligible for a fresh Payments partial_outage', () => {
    const decision = evaluateRouteEligibility(WISE_IDR, { health: health('partial_outage'), now: NOW });
    expect(decision.status).toBe('ineligible');
    expect(decision.reasons).toEqual(['provider_partial_outage']);
    expect(decision.evidence[0]).toMatchObject({
      observationType: 'provider_operational_health',
      componentStatus: 'partial_outage',
      freshness: 'fresh',
    });
  });

  it('marks Wise ineligible for a fresh Payments major_outage', () => {
    const decision = evaluateRouteEligibility(WISE_IDR, { health: health('major_outage'), now: NOW });
    expect(decision.status).toBe('ineligible');
    expect(decision.reasons).toEqual(['provider_major_outage']);
  });

  it('does not exclude a stale Payments major_outage', () => {
    const decision = evaluateRouteEligibility(WISE_IDR, {
      health: evaluateLatestObservation(health('major_outage', '2026-09-10T11:00:00.000Z'), NOW),
      now: NOW,
    });
    expect(decision.status).toBe('unknown');
    expect(decision.reasons).toEqual(['stale_observation']);
    expect(routeIsNotExcluded(decision)).toBe(true);
  });

  it('keeps Wise eligible when Payments health is missing', () => {
    const decision = evaluateRouteEligibility(WISE_IDR, { health: null, now: NOW });
    expect(decision.status).toBe('eligible');
    expect(decision.reasons).toEqual(['missing_observation']);
    expect(routeIsNotExcluded(decision)).toBe(true);
  });

  it('keeps Wise eligible when the observation is malformed or invalid', () => {
    const decision = evaluateRouteEligibility(WISE_IDR, {
      health: { kind: 'unavailable', reason: 'invalid' },
      now: NOW,
    });
    expect(decision.status).toBe('eligible');
    expect(routeIsNotExcluded(decision)).toBe(true);
  });

  it('does not exclude a Website incident', () => {
    const decision = evaluateRouteEligibility(WISE_IDR, {
      health: health('operational'),
      incidents: [
        incident({
          value: {
            ...incident().value,
            title: 'Website degraded',
            impact: 'major',
            affectedComponentIds: [WISE_WEBSITE_COMPONENT_ID],
            affectedComponentNames: ['Website'],
          },
        }),
      ],
      now: NOW,
    });
    expect(decision.status).toBe('eligible');
    expect(routeIsNotExcluded(decision)).toBe(true);
  });

  it('does not exclude an API-only incident with unknown route dependency', () => {
    const decision = evaluateRouteEligibility(WISE_IDR, {
      health: health('operational'),
      incidents: [
        incident({
          value: {
            ...incident().value,
            title: 'API errors',
            impact: 'major',
            affectedComponentIds: [WISE_API_COMPONENT_ID],
            affectedComponentNames: ['API'],
          },
        }),
      ],
      now: NOW,
    });
    expect(decision.status).toBe('eligible');
    expect(routeIsNotExcluded(decision)).toBe(true);
  });

  it("keeps today's unstructured AED incident eligible against AUD → IDR", () => {
    const decision = evaluateRouteEligibility(WISE_IDR, {
      health: health('operational'),
      incidents: [incident()],
      now: NOW,
    });
    expect(decision.status).toBe('eligible');
    expect(decision.evidence).toHaveLength(2);
    expect(decision.evidence[1]).toMatchObject({
      observationType: 'provider_payment_incident',
      incidentId: '10dy3hydcfdt',
      reason: 'no_structured_match',
    });
    expect(routeIsNotExcluded(decision)).toBe(true);
  });

  it('does not infer AED from incident prose against AUD → AED', () => {
    const decision = evaluateRouteEligibility(WISE_AED, {
      health: health('operational'),
      incidents: [incident()],
      now: NOW,
    });
    expect(decision.status).toBe('eligible');
    expect(decision.evidence[1]).toMatchObject({ reason: 'no_structured_match' });
    expect(routeIsNotExcluded(decision)).toBe(true);
  });

  it('excludes Wise AUD → AED when a future structured AED major incident is present', () => {
    const decision = evaluateRouteEligibility(WISE_AED, {
      health: health('operational'),
      incidents: [structuredAedMajor()],
      now: NOW,
    });
    expect(decision.status).toBe('ineligible');
    expect(decision.reasons).toEqual(['structured_route_incident']);
  });

  it('does not let a structured AED major incident exclude AUD → IDR', () => {
    const decision = evaluateRouteEligibility(WISE_IDR, {
      health: health('operational'),
      incidents: [structuredAedMajor()],
      now: NOW,
    });
    expect(decision.status).toBe('eligible');
    expect(decision.reasons).toEqual(['no_material_failure']);
    expect(routeIsNotExcluded(decision)).toBe(true);
  });

  it('never lets a Wise observation exclude an Airwallex route', () => {
    const decision = evaluateRouteEligibility(AIRWALLEX_IDR, {
      health: health('major_outage'),
      incidents: [structuredAedMajor()],
      now: NOW,
    });
    expect(decision.status).toBe('eligible');
    expect(decision.reasons).toEqual(['provider_mismatch']);
    expect(decision.providerId).toBe('airwallex');
    expect(routeIsNotExcluded(decision)).toBe(true);
  });

  it('preserves health and incident evidence as separate items', () => {
    const website = incident({
      subjectId: 'wise:incident:website-1',
      value: {
        ...incident().value,
        incidentId: 'website-1',
        title: 'Website degraded',
        affectedComponentIds: [WISE_WEBSITE_COMPONENT_ID],
        affectedComponentNames: ['Website'],
      },
    });
    const decision = evaluateRouteEligibility(WISE_IDR, {
      health: health('operational'),
      incidents: [incident(), website],
      now: NOW,
    });
    expect(decision.evidence).toHaveLength(3);
    expect(decision.evidence[0]).toMatchObject({
      observationType: 'provider_operational_health',
      componentStatus: 'operational',
    });
    expect(decision.evidence[1]).toMatchObject({
      observationType: 'provider_payment_incident',
      incidentId: '10dy3hydcfdt',
    });
    expect(decision.evidence[2]).toMatchObject({
      observationType: 'provider_payment_incident',
      incidentId: 'website-1',
    });
    expect(decision.status).toBe('eligible');
  });

  it('does not exclude when confidence is insufficient', () => {
    const untrusted = { ...health('major_outage'), confidence: 'unavailable' as const };
    const decision = evaluateRouteEligibility(WISE_IDR, { health: untrusted, now: NOW });
    expect(decision.status).toBe('eligible');
    expect(routeIsNotExcluded(decision)).toBe(true);
  });
});

describe('eligibility gate in public comparison', () => {
  const goldenOfferingIds = [
    'wise-international',
    'airwallex-international',
    'ofx-international',
    'bank-swift',
    'wise-local',
    'airwallex-local',
    'digital-dollar',
    'stripe-checkout',
    'paypal-checkout',
  ];

  it('keeps existing capability exclusions independent of operational health', () => {
    const indonesia = compareLandingRoutes({
      ...AUD_IDR_QUERY,
    });
    expect(indonesia.offerings.map((item) => item.id)).not.toContain('airwallex-international');
    expect(indonesia.offerings.find((item) => item.id === 'wise-international')?.coverageStatus).toBe(
      'supported'
    );

    const withOutage = compareLandingRoutes(AUD_IDR_QUERY, {
      wisePaymentsHealth: evaluateLatestObservation(health('major_outage'), NOW),
      now: NOW,
    });
    expect(withOutage.offerings.map((item) => item.id)).not.toContain('airwallex-international');
    expect(withOutage.offerings.map((item) => item.id)).not.toContain('wise-international');
  });

  it('leaves ranking goldens unchanged when no route is excluded', () => {
    const none = compareLandingRoutes(DEFAULT_LANDING_SEARCH);
    const operational = compareLandingRoutes(DEFAULT_LANDING_SEARCH, {
      wisePaymentsHealth: evaluateLatestObservation(health('operational'), NOW),
      wiseIncidents: [incident()],
      now: NOW,
    });
    const degraded = compareLandingRoutes(DEFAULT_LANDING_SEARCH, {
      wisePaymentsHealth: evaluateLatestObservation(health('degraded_performance'), NOW),
      now: NOW,
    });

    expect(none.offerings.map((item) => item.id)).toEqual(goldenOfferingIds);
    expect(operational.offerings.map((item) => item.id)).toEqual(goldenOfferingIds);
    expect(degraded.offerings.map((item) => item.id)).toEqual(goldenOfferingIds);
    expect(none.recommendedOffering.id).toBe('wise-international');
    expect(operational.recommendedOffering.id).toBe('wise-international');
    expect(degraded.recommendedOffering.id).toBe('wise-international');
    expect(rankLandingRoutes(DEFAULT_LANDING_SEARCH)[0]?.id).toBe('international_bank');
  });

  it('ranks remaining providers with the existing engine after Wise is excluded', () => {
    const baseline = compareLandingRoutes(DEFAULT_LANDING_SEARCH);
    const excluded = compareLandingRoutes(DEFAULT_LANDING_SEARCH, {
      wisePaymentsHealth: evaluateLatestObservation(health('major_outage'), NOW),
      now: NOW,
    });
    const remaining = baseline.offerings.filter((item) => item.offering.providerId !== 'wise');

    expect(excluded.offerings.map((item) => item.id)).toEqual(remaining.map((item) => item.id));
    expect(excluded.offerings.map((item) => item.score)).toEqual(remaining.map((item) => item.score));
    expect(excluded.recommendedOffering.id).toBe(remaining[0]?.id);
    expect(rankLandingRoutes(DEFAULT_LANDING_SEARCH)).toEqual(
      rankLandingRoutes({ ...DEFAULT_LANDING_SEARCH, destinationCurrency: 'IDR' })
    );
  });

  it('does not fetch a network host during public comparison', () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    compareLandingRoutes(DEFAULT_LANDING_SEARCH, {
      wisePaymentsHealth: evaluateLatestObservation(health('major_outage'), NOW),
      wiseIncidents: [incident()],
      now: NOW,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();

    const comparison = fs.readFileSync(
      path.join(process.cwd(), 'lib/journey/landing-route-comparison.ts'),
      'utf8'
    );
    const rank = fs.readFileSync(path.join(process.cwd(), 'lib/journey/landing-route-rank.ts'), 'utf8');
    expect(comparison).not.toContain('fetch(');
    expect(comparison).not.toContain('status.wise.com');
    expect(rank).not.toContain('fetch(');
  });
});

describe('AUD → IDR operational-state regression', () => {
  it('removes Wise from candidates when Payments has a fresh major_outage and keeps existing scores', () => {
    const baseline = compareLandingRoutes(AUD_IDR_QUERY);
    expect(baseline.recommendedOffering.id).toBe('wise-international');

    const snapshot = getPublicRouteIntelligenceSnapshot({
      wisePaymentsHealth: evaluateLatestObservation(health('major_outage'), NOW),
      evaluateRoutes: [WISE_IDR, AIRWALLEX_IDR],
      now: NOW,
    });
    expect(snapshot.eligibilityDecisions.find((item) => item.offeringId === 'wise-international')?.status).toBe(
      'ineligible'
    );
    expect(snapshot.eligibilityDecisions.find((item) => item.offeringId === 'airwallex-international')?.status).toBe(
      'eligible'
    );
    expect(snapshot.capabilities).toBe(CORRIDOR_CAPABILITY_MATRIX);

    const excluded = compareLandingRoutes(AUD_IDR_QUERY, {
      wisePaymentsHealth: evaluateLatestObservation(health('major_outage'), NOW),
      now: NOW,
    });
    const remaining = baseline.offerings.filter((item) => item.offering.providerId !== 'wise');

    expect(excluded.offerings.map((item) => item.id)).not.toContain('wise-international');
    expect(excluded.offerings.map((item) => item.id)).not.toContain('wise-local');
    expect(excluded.offerings.map((item) => item.id)).toEqual(remaining.map((item) => item.id));
    expect(excluded.offerings.map((item) => item.score)).toEqual(remaining.map((item) => item.score));
    expect(excluded.recommendedOffering.id).toBe(remaining[0]?.id);
    expect(excluded.recommendedOffering.offering.providerId).not.toBe('wise');
    expect(rankLandingRoutes(AUD_IDR_QUERY)).toEqual(rankLandingRoutes(DEFAULT_LANDING_SEARCH));
  });

  it('keeps the existing Wise recommendation when the same major_outage is stale', () => {
    const baseline = compareLandingRoutes(AUD_IDR_QUERY);
    const stale = compareLandingRoutes(AUD_IDR_QUERY, {
      wisePaymentsHealth: evaluateLatestObservation(health('major_outage', '2026-09-10T11:00:00.000Z'), NOW),
      now: NOW,
    });

    expect(stale.recommendedOffering.id).toBe('wise-international');
    expect(stale.offerings.map((item) => item.id)).toEqual(baseline.offerings.map((item) => item.id));
    expect(stale.offerings.map((item) => item.score)).toEqual(baseline.offerings.map((item) => item.score));
    expect(stale.offerings.find((item) => item.id === 'wise-international')?.operationalEligibility.status).toBe(
      'unknown'
    );
  });
});
