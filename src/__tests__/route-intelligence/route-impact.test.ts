import { compareLandingRoutes, DEFAULT_LANDING_SEARCH, rankLandingRoutes } from '@/lib/journey/landing-route-comparison';
import {
  CORRIDOR_CAPABILITY_MATRIX,
  evaluateLatestObservation,
  evaluateRouteImpact,
  getPublicRouteIntelligenceSnapshot,
  observationStaleAfter,
  WISE_API_COMPONENT_ID,
  WISE_PAYMENTS_COMPONENT_ID,
  WISE_WEBSITE_COMPONENT_ID,
} from '@/lib/route-intelligence';
import type {
  ProviderOperationalHealthObservation,
  ProviderPaymentIncidentObservation,
  RouteImpactSubject,
} from '@/lib/route-intelligence/types';

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

describe('shadow route-impact evaluation', () => {
  it('treats operational Payments health as not_affected', () => {
    const result = evaluateRouteImpact(WISE_IDR, { health: health('operational'), now: NOW });
    expect(result.mode).toBe('shadow');
    expect(result.operationalHealth.status).toBe('not_affected');
    expect(result.operationalHealth.reason).toBe('provider_operational_health');
    expect(result.operationalHealth.freshness).toBe('fresh');
    expect(result.operationalHealth.componentStatus).toBe('operational');
    expect(result.overallImpact).toBe('not_affected');
  });

  it.each([
    ['degraded_performance'],
    ['partial_outage'],
    ['major_outage'],
  ] as const)('treats Payments %s as affected', (status) => {
    const result = evaluateRouteImpact(WISE_IDR, { health: health(status), now: NOW });
    expect(result.operationalHealth.status).toBe('affected');
    expect(result.operationalHealth.reason).toBe('provider_operational_health');
    expect(result.operationalHealth.componentStatus).toBe(status);
    expect(result.overallImpact).toBe('affected');
  });

  it('keeps an unstructured AED incident unknown against AUD → IDR', () => {
    const result = evaluateRouteImpact(WISE_IDR, {
      health: health('operational'),
      incidents: [incident()],
      now: NOW,
    });
    expect(result.operationalHealth.status).toBe('not_affected');
    expect(result.incidents[0]?.status).toBe('unknown');
    expect(result.incidents[0]?.reason).toBe('no_structured_match');
    expect(result.incidents[0]?.routeRelevance).toBe('unknown');
    expect(result.overallImpact).toBe('unknown');
    expect(result.overallImpact).not.toBe('not_affected');
    expect(result.incidents[0]?.sourceUrl).toContain('status.wise.com/incidents/10dy3hydcfdt');
    expect(result.incidents[0]?.provenance).toBe('externally_sourced');
    expect(JSON.stringify(result.incidents[0])).not.toContain('AU→AE');
  });

  it('marks a structured AED incident affected against AUD → AED', () => {
    const result = evaluateRouteImpact(WISE_AED, {
      incidents: [
        incident({
          value: incident().value && {
            ...incident().value,
            structuredRoute: { destinationCurrency: 'AED' },
          },
        }),
      ],
      now: NOW,
    });
    expect(result.incidents[0]?.status).toBe('affected');
    expect(result.incidents[0]?.reason).toBe('explicit_currency_match');
    expect(result.overallImpact).toBe('affected');
  });

  it('does not let a Wise AED incident affect an Airwallex route', () => {
    const result = evaluateRouteImpact(AIRWALLEX_IDR, {
      health: health('major_outage'),
      incidents: [
        incident({
          value: { ...incident().value, structuredRoute: { destinationCurrency: 'AED' } },
        }),
      ],
      now: NOW,
    });
    expect(result.operationalHealth.status).toBe('not_affected');
    expect(result.operationalHealth.reason).toBe('provider_mismatch');
    expect(result.incidents[0]?.status).toBe('not_affected');
    expect(result.incidents[0]?.reason).toBe('provider_mismatch');
    expect(result.overallImpact).toBe('not_affected');
  });

  it('does not mark a payment route affected by a Website incident', () => {
    const result = evaluateRouteImpact(WISE_IDR, {
      health: health('operational'),
      incidents: [
        incident({
          value: {
            ...incident().value,
            title: 'Website degraded',
            affectedComponentIds: [WISE_WEBSITE_COMPONENT_ID],
            affectedComponentNames: ['Website'],
          },
        }),
      ],
      now: NOW,
    });
    expect(result.incidents[0]?.status).toBe('not_affected');
    expect(result.incidents[0]?.reason).toBe('non_payment_component');
    expect(result.overallImpact).toBe('not_affected');
  });

  it('does not treat an API-only incident as a payment-route failure', () => {
    const result = evaluateRouteImpact(WISE_IDR, {
      health: health('operational'),
      incidents: [
        incident({
          value: {
            ...incident().value,
            title: 'API errors',
            affectedComponentIds: [WISE_API_COMPONENT_ID],
            affectedComponentNames: ['API'],
          },
        }),
      ],
      now: NOW,
    });
    expect(result.incidents[0]?.status).toBe('unknown');
    expect(result.incidents[0]?.reason).toBe('unknown_component_dependency');
    expect(result.overallImpact).toBe('unknown');
  });

  it('does not treat a stale observation as healthy', () => {
    const stale = health('operational', '2026-09-10T11:00:00.000Z');
    const result = evaluateRouteImpact(WISE_IDR, {
      health: evaluateLatestObservation(stale, NOW),
      now: NOW,
    });
    expect(result.operationalHealth.freshness).toBe('stale');
    expect(result.operationalHealth.status).toBe('unknown');
    expect(result.operationalHealth.reason).toBe('stale_observation');
    expect(result.operationalHealth.componentStatus).toBe('operational');
    expect(result.overallImpact).toBe('unknown');
    expect(result.overallImpact).not.toBe('not_affected');
  });

  it('does not treat a missing observation as healthy', () => {
    const result = evaluateRouteImpact(WISE_IDR, { health: null, now: NOW });
    expect(result.operationalHealth.freshness).toBe('missing');
    expect(result.operationalHealth.status).toBe('unknown');
    expect(result.operationalHealth.reason).toBe('missing_observation');
    expect(result.overallImpact).toBe('unknown');
  });

  it('keeps multiple incidents individually inspectable', () => {
    const aed = incident();
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
    const result = evaluateRouteImpact(WISE_IDR, {
      health: health('operational'),
      incidents: [aed, website],
      now: NOW,
    });
    expect(result.incidents).toHaveLength(2);
    expect(result.incidents[0]?.incidentId).toBe('10dy3hydcfdt');
    expect(result.incidents[0]?.status).toBe('unknown');
    expect(result.incidents[1]?.incidentId).toBe('website-1');
    expect(result.incidents[1]?.status).toBe('not_affected');
    expect(result.overallImpact).toBe('unknown');
  });

  it('exposes shadow evaluations on the snapshot without changing ranking', () => {
    const snapshot = getPublicRouteIntelligenceSnapshot({
      wisePaymentsHealth: evaluateLatestObservation(health('operational'), NOW),
      wiseIncidents: [incident()],
      evaluateRoutes: [WISE_IDR],
      now: NOW,
    });
    expect(snapshot.routeImpacts).toHaveLength(1);
    expect(snapshot.routeImpacts[0]?.mode).toBe('shadow');
    expect(snapshot.routeImpacts[0]?.overallImpact).toBe('unknown');
    expect(snapshot.capabilities).toBe(CORRIDOR_CAPABILITY_MATRIX);

    const query = {
      ...DEFAULT_LANDING_SEARCH,
      originCountry: 'AU' as const,
      destinationCountry: 'ID' as const,
      transactionType: 'supplier_payment' as const,
      priority: 'lowest_cost' as const,
    };
    const comparison = compareLandingRoutes(query);
    expect(rankLandingRoutes(query)[0]?.id).toBe('international_bank');
    expect(comparison.recommendedOffering.offering.id).toBe('wise-international');
  });

  it('does not populate structured route claims from incident prose', () => {
    const result = evaluateRouteImpact(WISE_AED, { incidents: [incident()], now: NOW });
    expect(result.incidents[0]?.status).toBe('unknown');
    expect(result.incidents[0]?.reason).toBe('no_structured_match');
  });
});
