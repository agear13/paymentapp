import {
  LANDING_PROVIDER_OFFERINGS,
  type LandingProviderOffering,
} from '@/lib/journey/landing-provider-catalog';
import type {
  Corridor,
  CurrencyPair,
  Offering,
  PricingSnapshot,
  Route,
} from '@/lib/route-intelligence/types';

/**
 * Static catalogue adapter. LANDING_PROVIDER_OFFERINGS remains the source of truth.
 * Does not invent network rails, live prices, or timestamps.
 */
export const STATIC_CATALOG_SOURCE_ID = 'static-provider-catalog';

/** Indicative catalog fee only. Never emits a provider_fee_observation. */
function mapPricing(offering: LandingProviderOffering): PricingSnapshot {
  return {
    provenance: 'indicative',
    model: offering.fee.model,
    percent: offering.fee.percent,
    fixed: offering.fee.fixed,
    note: offering.fee.note,
    observedAt: null,
  };
}

export function mapCatalogOffering(offering: LandingProviderOffering): Offering {
  return {
    id: offering.id,
    provider: {
      id: offering.providerId,
      name: offering.providerName,
    },
    productName: offering.productName,
    mechanism: offering.mechanism,
    corridorClass: offering.corridors,
    capability: {
      corridorClass: offering.corridors,
      transactionTypes: offering.transactionTypes,
    },
    networkRails: ['unknown'],
    pricing: mapPricing(offering),
    fx: {
      provenance: 'indicative',
      label: offering.fxLabel,
      rate: null,
      observedAt: null,
    },
    availability: {
      provenance: 'indicative',
      type: 'typical',
      observedAt: null,
    },
    settlement: {
      provenance: 'indicative',
      speedBand: offering.speedBand,
      arrivalLabel: offering.arrivalLabel,
      observedAt: null,
    },
    priorityAdj: offering.priorityAdj,
    live: false,
    provenance: 'curated',
    source: 'static_catalog',
  };
}

export function mapCatalogOfferings(
  offerings: readonly LandingProviderOffering[] = LANDING_PROVIDER_OFFERINGS
): Offering[] {
  return offerings.map(mapCatalogOffering);
}

/** Source catalogue rows — same objects as LANDING_PROVIDER_OFFERINGS. */
export function getStaticCatalogOfferings(): readonly LandingProviderOffering[] {
  return LANDING_PROVIDER_OFFERINGS;
}

export function catalogRouteFor(
  offering: Offering,
  corridor: Corridor,
  currencyPair: CurrencyPair | null
): Route {
  return {
    offeringId: offering.id,
    providerId: offering.provider.id,
    mechanism: offering.mechanism,
    corridor,
    currencyPair,
    networkRails: offering.networkRails,
  };
}
