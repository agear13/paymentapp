import { LANDING_PROVIDER_OFFERINGS } from '@/lib/journey/landing-provider-catalog';
import { PAYMENT_INTELLIGENCE_FEED, PAYMENT_INTELLIGENCE_SNAPSHOT_DATE } from '@/lib/journey/payment-intelligence-feed';
import {
  catalogRouteFor,
  getPublicRouteIntelligenceSnapshot,
  getStaticCatalogOfferings,
  mapCatalogOfferings,
  mapCuratedDevelopments,
} from '@/lib/route-intelligence';

describe('static catalog adapter', () => {
  const offerings = mapCatalogOfferings();

  it('contains the same number of offerings as the existing catalogue', () => {
    expect(offerings).toHaveLength(LANDING_PROVIDER_OFFERINGS.length);
    expect(getStaticCatalogOfferings()).toBe(LANDING_PROVIDER_OFFERINGS);
  });

  it('preserves offering ids, providers, mechanisms, fees, and priority adjustments', () => {
    expect(offerings.map((item) => item.id)).toEqual(LANDING_PROVIDER_OFFERINGS.map((item) => item.id));
    expect(offerings.map((item) => item.provider.id)).toEqual(
      LANDING_PROVIDER_OFFERINGS.map((item) => item.providerId)
    );
    expect(offerings.map((item) => item.mechanism)).toEqual(
      LANDING_PROVIDER_OFFERINGS.map((item) => item.mechanism)
    );
    expect(offerings.map((item) => item.priorityAdj)).toEqual(
      LANDING_PROVIDER_OFFERINGS.map((item) => item.priorityAdj)
    );

    offerings.forEach((item, index) => {
      const source = LANDING_PROVIDER_OFFERINGS[index];
      expect(item.live).toBe(false);
      expect(source.live).toBe(false);
      expect(item.provenance).toBe('curated');
      expect(item.source).toBe('static_catalog');
      expect(item.pricing.provenance).toBe('indicative');
      expect(item.pricing.model).toBe(source.fee.model);
      expect(item.pricing.percent).toBe(source.fee.percent);
      expect(item.pricing.fixed).toBe(source.fee.fixed);
      expect(item.pricing.note).toBe(source.fee.note);
      expect(item.pricing.observedAt).toBeNull();
      expect(item.fx.rate).toBeNull();
      expect(item.fx.observedAt).toBeNull();
      expect(item.availability.observedAt).toBeNull();
      expect(item.settlement.observedAt).toBeNull();
    });
  });

  it('leaves unknown network rails unknown instead of inferring them', () => {
    offerings.forEach((item) => {
      expect(item.networkRails).toEqual(['unknown']);
    });
    expect(offerings.find((item) => item.id === 'bank-swift')?.networkRails).toEqual(['unknown']);
  });

  it('builds a query-specific route without inventing a rail or currency pair', () => {
    const wise = offerings.find((item) => item.id === 'wise-international');
    expect(wise).toBeDefined();
    expect(
      catalogRouteFor(wise!, { origin: 'AU', destination: 'ID' }, null)
    ).toEqual({
      offeringId: 'wise-international',
      providerId: 'wise',
      mechanism: 'international_bank',
      corridor: { origin: 'AU', destination: 'ID' },
      currencyPair: null,
      networkRails: ['unknown'],
    });
  });
});

describe('curated developments adapter', () => {
  it('maps the feed as regulatory evidence, not as routes', () => {
    const developments = mapCuratedDevelopments();
    expect(developments).toHaveLength(PAYMENT_INTELLIGENCE_FEED.length);
    expect(developments.map((item) => item.id)).toEqual(PAYMENT_INTELLIGENCE_FEED.map((item) => item.id));
    developments.forEach((item) => {
      expect(item.provenance).toBe('curated');
      expect(item.freshness).toBe('catalog_snapshot');
      expect(item.confidence).toBe('catalog');
      expect(item).not.toHaveProperty('mechanism');
      expect(item).not.toHaveProperty('priorityAdj');
    });
  });

  it('classifies only explicit provider and network-rail ids from the mixed mark list', () => {
    const swift = mapCuratedDevelopments().find((item) => item.id === 'swift-retail-framework-2026-03');
    expect(swift?.relatedNetworkRails).toEqual(['swift']);
    expect(swift?.relatedProviderIds).toEqual(['bank']);

    const rba = mapCuratedDevelopments().find((item) => item.id === 'rba-psr-review-2026-06');
    expect(rba?.relatedNetworkRails).toEqual(['npp', 'visa', 'mastercard']);
    expect(rba?.relatedProviderIds).toEqual(['bank']);
  });
});

describe('public catalog snapshot', () => {
  it('exposes a catalog/static snapshot without fabricated retrieval times', () => {
    const snapshot = getPublicRouteIntelligenceSnapshot();
    expect(snapshot.kind).toBe('catalog_static');
    expect(snapshot.provenance).toBe('curated');
    expect(snapshot.freshness).toBe('catalog_snapshot');
    expect(snapshot.intelligenceSnapshotDate).toBe(PAYMENT_INTELLIGENCE_SNAPSHOT_DATE);
    expect(snapshot.catalogOfferings).toBe(LANDING_PROVIDER_OFFERINGS);
    expect(snapshot.offerings).toHaveLength(LANDING_PROVIDER_OFFERINGS.length);
    expect(snapshot.developments).toHaveLength(PAYMENT_INTELLIGENCE_FEED.length);
    expect(snapshot.capabilities.length).toBeGreaterThan(0);
    expect(snapshot.observations).toEqual([]);
    expect(snapshot.incidents).toEqual([]);
    expect(snapshot.otherIncidents).toEqual([]);
    expect(snapshot.routeImpacts).toEqual([]);
    expect(snapshot.feeObservations).toEqual([]);
    expect(snapshot.regulatoryObservations).toEqual([]);
    expect(snapshot.regulatoryImpacts).toEqual([]);
    expect(snapshot.offeringRailMappings).toEqual([]);
    expect(JSON.stringify(snapshot)).not.toMatch(/retrievedAt":"[^n]/);
    expect(snapshot.offerings.every((item) => item.pricing.observedAt === null)).toBe(true);
  });
});
