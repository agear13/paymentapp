import { PAYMENT_INTELLIGENCE_FEED } from '@/lib/journey/payment-intelligence-feed';
import {
  CORRIDOR_CAPABILITY_MATRIX,
  evaluateLatestObservation,
  getPublicRouteIntelligenceSnapshot,
  observationStaleAfter,
} from '@/lib/route-intelligence';
import type { ProviderOperationalHealthObservation } from '@/lib/route-intelligence/types';

const NOW = new Date('2026-09-10T15:00:00.000Z');

function wisePaymentsObservation(
  overrides: Partial<ProviderOperationalHealthObservation> = {}
): ProviderOperationalHealthObservation {
  const fetchedAt = overrides.fetchedAt ?? '2026-09-10T14:00:00.000Z';
  return {
    observationType: 'provider_operational_health',
    subjectKind: 'provider_component',
    subjectId: 'wise:payments',
    providerId: 'wise',
    value: {
      pageIndicator: 'none',
      pageDescription: 'All Systems Operational',
      componentId: '2jxb8y760wrd',
      componentName: 'Payments',
      componentStatus: 'operational',
    },
    observedAt: '2026-09-10T13:09:10.107Z',
    fetchedAt,
    sourceId: 'wise_statuspage',
    sourceUrl: 'https://status.wise.com/api/v2/summary.json',
    provenance: 'externally_sourced',
    confidence: 'high',
    staleAfter: observationStaleAfter(fetchedAt).toISOString(),
    rawHash: 'abc',
    rawEvidence: {
      pageUpdatedAt: '2026-09-10T13:09:10.107Z',
      pageIndicator: 'none',
      pageDescription: 'All Systems Operational',
      componentId: '2jxb8y760wrd',
      componentName: 'Payments',
      componentStatus: 'operational',
    },
    ...overrides,
  };
}

describe('snapshot observation attach', () => {
  it('leaves catalogue availability indicative when no observation is supplied', () => {
    const snapshot = getPublicRouteIntelligenceSnapshot();
    expect(snapshot.kind).toBe('catalog_static');
    expect(snapshot.observations).toEqual([]);
    expect(snapshot.incidents).toEqual([]);
    expect(snapshot.otherIncidents).toEqual([]);
    expect(snapshot.routeImpacts).toEqual([]);
    expect(snapshot.eligibilityDecisions).toEqual([]);
    expect(snapshot.feeObservations).toEqual([]);
    expect(snapshot.regulatoryObservations).toEqual([]);
    expect(snapshot.regulatoryImpacts).toEqual([]);
    expect(snapshot.offeringRailMappings).toEqual([]);
    expect(snapshot.networkRails.length).toBeGreaterThan(0);
    expect(
      snapshot.offerings.every((item) => item.availability.provenance === 'indicative')
    ).toBe(true);
  });

  it('attaches a fresh Wise Payments observation only to Wise payment-route offerings', () => {
    const observation = wisePaymentsObservation();
    const snapshot = getPublicRouteIntelligenceSnapshot({
      wisePaymentsHealth: evaluateLatestObservation(observation, NOW),
    });

    expect(snapshot.kind).toBe('catalog_plus_observations');
    expect(snapshot.observations).toHaveLength(1);
    expect(snapshot.offerings.find((item) => item.id === 'wise-international')?.availability).toEqual({
      provenance: 'externally_sourced',
      type: 'observed',
      observedAt: observation.observedAt,
      sourceUrl: observation.sourceUrl,
      componentStatus: 'operational',
      pageIndicator: 'none',
      freshness: 'current',
    });
    expect(snapshot.offerings.find((item) => item.id === 'wise-local')?.availability.provenance).toBe(
      'externally_sourced'
    );
    expect(snapshot.offerings.find((item) => item.id === 'airwallex-international')?.availability).toEqual({
      provenance: 'indicative',
      type: 'typical',
      observedAt: null,
    });
    expect(snapshot.offerings.find((item) => item.id === 'ofx-international')?.availability.provenance).toBe(
      'indicative'
    );
    expect(snapshot.offerings.find((item) => item.id === 'stripe-checkout')?.availability.provenance).toBe(
      'indicative'
    );
  });

  it('does not attach a stale operational observation as operational', () => {
    const snapshot = getPublicRouteIntelligenceSnapshot({
      wisePaymentsHealth: evaluateLatestObservation(
        wisePaymentsObservation({ fetchedAt: '2026-09-10T11:00:00.000Z' }),
        NOW
      ),
    });
    const wise = snapshot.offerings.find((item) => item.id === 'wise-international');
    expect(wise?.availability).toEqual({
      provenance: 'unavailable',
      type: 'unobserved',
      observedAt: null,
      reason: 'stale',
    });
  });

  it('keeps capability rows independent of operational health', () => {
    const snapshot = getPublicRouteIntelligenceSnapshot({
      wisePaymentsHealth: evaluateLatestObservation(
        wisePaymentsObservation({
          value: {
            pageIndicator: 'critical',
            pageDescription: 'Major Service Outage',
            componentId: '2jxb8y760wrd',
            componentName: 'Payments',
            componentStatus: 'major_outage',
          },
        }),
        NOW
      ),
    });
    expect(snapshot.capabilities).toBe(CORRIDOR_CAPABILITY_MATRIX);
    expect(
      snapshot.capabilities.some(
        (row) => row.offeringId === 'wise-international' && row.status === 'supported'
      )
    ).toBe(true);
  });

  it('keeps curated Payment Intelligence independent of operational health', () => {
    const snapshot = getPublicRouteIntelligenceSnapshot({
      wisePaymentsHealth: evaluateLatestObservation(wisePaymentsObservation(), NOW),
    });
    expect(snapshot.developments).toHaveLength(PAYMENT_INTELLIGENCE_FEED.length);
    expect(snapshot.developments.map((item) => item.id)).toEqual(
      PAYMENT_INTELLIGENCE_FEED.map((item) => item.id)
    );
    expect(snapshot.developments.every((item) => item.provenance === 'curated')).toBe(true);
  });
});
