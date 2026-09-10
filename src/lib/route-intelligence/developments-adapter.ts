import { PAYMENT_INTELLIGENCE_FEED } from '@/lib/journey/payment-intelligence-feed';
import type { PaymentIntelligenceItem, PaymentRailId } from '@/lib/journey/payment-intelligence-types';
import type { NetworkRailId, ProviderId, RegulatorySignal } from '@/lib/route-intelligence/types';

/**
 * Curated Payment Intelligence adapter.
 * These items are developments / evidence — not routes and not a ranking input.
 */
export const CURATED_DEVELOPMENTS_SOURCE_ID = 'curated-developments';

const PROVIDER_IDS = new Set<ProviderId>([
  'wise',
  'airwallex',
  'ofx',
  'stripe',
  'paypal',
  'bank',
  'digital_dollar',
]);

const NETWORK_RAIL_IDS = new Set<NetworkRailId>([
  'swift',
  'npp',
  'visa',
  'mastercard',
  'apple_pay',
  'google_pay',
]);

function relatedProviderIds(rails: PaymentRailId[]): ProviderId[] {
  return rails.filter((id): id is ProviderId => PROVIDER_IDS.has(id as ProviderId));
}

function relatedNetworkRails(rails: PaymentRailId[]): NetworkRailId[] {
  return rails.filter((id): id is NetworkRailId => NETWORK_RAIL_IDS.has(id as NetworkRailId));
}

export function mapDevelopment(item: PaymentIntelligenceItem): RegulatorySignal {
  return {
    id: item.id,
    publishedAt: item.publishedAt,
    source: item.source,
    sourceUrl: item.sourceUrl,
    headline: item.headline,
    summary: item.summary,
    businessImpact: item.businessImpact,
    countries: [...item.countries],
    corridors: item.corridors.map((corridor) =>
      corridor === 'cross_border'
        ? 'cross_border'
        : { origin: corridor.origin, destination: corridor.destination }
    ),
    relatedProviderIds: relatedProviderIds(item.rails),
    relatedNetworkRails: relatedNetworkRails(item.rails),
    provenance: 'curated',
    freshness: 'catalog_snapshot',
    confidence: 'catalog',
  };
}

export function mapCuratedDevelopments(
  items: readonly PaymentIntelligenceItem[] = PAYMENT_INTELLIGENCE_FEED
): RegulatorySignal[] {
  return items.map(mapDevelopment);
}
