import {
  LANDING_PROVIDER_CATALOG_UPDATED,
  LANDING_PROVIDER_OFFERINGS,
  type LandingProviderOffering,
} from '@/lib/journey/landing-provider-catalog';
import {
  buildCatalogSource,
  buildIndicativePricing,
  buildTypicalAvailability,
  type LandingResultAvailability,
  type LandingResultPricing,
  type LandingResultSource,
} from '@/lib/journey/landing-provider-pricing';
import {
  bestForTag,
  recipientScanLabel,
  setupScanLabel,
  type LandingResultFilters,
} from '@/lib/journey/landing-result-labels';
import { rankLandingRoutes } from '@/lib/journey/landing-route-rank';
import {
  isDomestic,
  priorityLabel,
  type LandingSearchQuery,
} from '@/lib/journey/landing-route-model';

export type LandingResultSort =
  | 'recommended'
  | 'lowest_cost'
  | 'fastest'
  | 'simplest'
  | 'lowest_effort';

export type { LandingResultFilters };

export const EMPTY_LANDING_FILTERS: LandingResultFilters = {
  paymentMethods: [],
  providerTypes: [],
  speed: [],
  cost: [],
  setup: [],
  recipient: [],
  business: [],
};

export type LandingProviderResult = {
  id: string;
  offering: LandingProviderOffering;
  score: number;
  isRecommended: boolean;
  indicativeCost: number | null;
  indicativeCostLabel: string;
  whyShort: string;
  bestFor: string;
  setupScan: string;
  recipientScan: string;
  pricing: LandingResultPricing;
  availability: LandingResultAvailability;
  source: LandingResultSource;
  pricingStatus: 'indicative';
  live: false;
  catalogUpdated: string;
};

const SPEED_ORDER: Record<LandingProviderOffering['speedBand'], number> = {
  instant: 0,
  same_day: 1,
  one_to_two_days: 2,
  three_plus_days: 3,
};

const SETUP_ORDER: Record<LandingProviderOffering['setupBand'], number> = {
  no_account: 0,
  existing_account: 1,
  business_account: 2,
  additional_setup: 3,
};

function offeringApplies(offering: LandingProviderOffering, query: LandingSearchQuery): boolean {
  const domestic = isDomestic(query);
  if (offering.corridors === 'domestic' && !domestic) return false;
  if (offering.corridors === 'cross_border' && domestic) return false;
  if (offering.transactionTypes !== 'all' && !offering.transactionTypes.includes(query.transactionType)) {
    return false;
  }
  return true;
}

export function indicativeCostAmount(
  offering: LandingProviderOffering,
  amount: number
): number | null {
  return buildIndicativePricing(offering, amount, 'AUD').amount;
}

function whyShort(offering: LandingProviderOffering, query: LandingSearchQuery): string {
  const type = query.transactionType.replace(/_/g, ' ');
  switch (query.priority) {
    case 'lowest_cost':
      return `Low estimated total cost with straightforward setup for this ${type}.`;
    case 'fastest':
      return `Typically among the faster ways to complete this ${type}, given the details you provided.`;
    case 'simplest':
      return `Familiar setup relative to the other routes shown for this ${type}.`;
  }
}

export function buildProviderResults(query: LandingSearchQuery): LandingProviderResult[] {
  const mechanismRank = new Map(rankLandingRoutes(query).map((entry, index) => [entry.id, { ...entry, index }]));

  const scored = LANDING_PROVIDER_OFFERINGS.filter((offering) => offeringApplies(offering, query))
    .map((offering) => {
      const mechanism = mechanismRank.get(offering.mechanism);
      const mechanismScore = mechanism?.score ?? 0;
      const adj = offering.priorityAdj[query.priority];
      const score = mechanismScore + adj;
      const pricing = buildIndicativePricing(offering, query.amount, query.currency);
      return {
        id: offering.id,
        offering,
        score,
        isRecommended: false,
        indicativeCost: pricing.amount,
        indicativeCostLabel: pricing.totalLabel,
        whyShort: whyShort(offering, query),
        bestFor: '',
        setupScan: setupScanLabel(offering.setupBand),
        recipientScan: recipientScanLabel(offering.recipientNeeds),
        pricing,
        availability: buildTypicalAvailability(),
        source: buildCatalogSource(offering.providerName),
        pricingStatus: 'indicative' as const,
        live: false as const,
        catalogUpdated: LANDING_PROVIDER_CATALOG_UPDATED,
      };
    })
    .sort((a, b) => b.score - a.score || a.offering.providerName.localeCompare(b.offering.providerName));

  if (scored[0]) {
    scored[0] = {
      ...scored[0],
      isRecommended: true,
      bestFor: bestForTag(scored[0].offering, query, true),
    };
  }

  return scored.map((item) =>
    item.isRecommended ? item : { ...item, bestFor: bestForTag(item.offering, query, false) }
  );
}

export function filterProviderResults(
  results: LandingProviderResult[],
  filters: LandingResultFilters
): LandingProviderResult[] {
  const has = <T,>(selected: T[], value: T | T[]) => {
    if (selected.length === 0) return true;
    const values = Array.isArray(value) ? value : [value];
    return values.some((item) => selected.includes(item));
  };

  return results.filter((result) => {
    const offering = result.offering;
    return (
      has(filters.paymentMethods, offering.paymentMethods) &&
      has(filters.providerTypes, offering.providerType) &&
      has(filters.speed, offering.speedBand) &&
      has(filters.cost, offering.costBands) &&
      has(filters.setup, offering.setupBand) &&
      has(filters.recipient, offering.recipientNeeds) &&
      has(filters.business, offering.businessTraits)
    );
  });
}

export function sortProviderResults(
  results: LandingProviderResult[],
  sort: LandingResultSort
): LandingProviderResult[] {
  const copy = [...results];
  copy.sort((a, b) => {
    switch (sort) {
      case 'lowest_cost': {
        const aCost = a.indicativeCost ?? Number.POSITIVE_INFINITY;
        const bCost = b.indicativeCost ?? Number.POSITIVE_INFINITY;
        return aCost - bCost || b.score - a.score;
      }
      case 'fastest':
        return (
          SPEED_ORDER[a.offering.speedBand] - SPEED_ORDER[b.offering.speedBand] || b.score - a.score
        );
      case 'simplest':
      case 'lowest_effort':
        return (
          SETUP_ORDER[a.offering.setupBand] - SETUP_ORDER[b.offering.setupBand] || b.score - a.score
        );
      case 'recommended':
      default:
        return b.score - a.score || a.offering.providerName.localeCompare(b.offering.providerName);
    }
  });
  return copy;
}

export function activeFilterCount(filters: LandingResultFilters): number {
  return (
    filters.paymentMethods.length +
    filters.providerTypes.length +
    filters.speed.length +
    filters.cost.length +
    filters.setup.length +
    filters.recipient.length +
    filters.business.length
  );
}

export function resultCountLabel(visible: number, total: number, filtered: boolean): string {
  if (!filtered) {
    return `${total} ${total === 1 ? 'payment route' : 'payment routes'} found`;
  }
  if (visible === 0) return 'No routes match your filters';
  if (visible === 1) return '1 payment route matches your filters';
  return `${visible} payment routes match your filters`;
}

export function recommendedWhy(result: LandingProviderResult, query: LandingSearchQuery): string {
  const priority = priorityLabel(query.priority).toLowerCase();
  return `Provvy puts ${result.offering.providerName} first for ${priority} among the indicative routes shown.`;
}

export const LANDING_SORT_OPTIONS: { id: LandingResultSort; label: string }[] = [
  { id: 'recommended', label: 'Best match' },
  { id: 'lowest_cost', label: 'Lowest cost' },
  { id: 'fastest', label: 'Fastest' },
  { id: 'simplest', label: 'Simplest' },
  { id: 'lowest_effort', label: 'Lowest operational effort' },
];
