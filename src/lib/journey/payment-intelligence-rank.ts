import {
  PAYMENT_INTELLIGENCE_FEED,
  PAYMENT_INTELLIGENCE_SNAPSHOT_DATE,
  PAYMENT_RAIL_WATCHLIST,
} from '@/lib/journey/payment-intelligence-feed';
import type {
  PaymentIntelligenceItem,
  PaymentIntelligenceQuery,
  PaymentIntelligenceSearchHint,
  PaymentIntelligenceSignal,
  PaymentRailWatchItem,
  PaymentWatchScope,
  RankedPaymentIntelligence,
} from '@/lib/journey/payment-intelligence-types';
import { EMPTY_LANDING_FILTERS } from '@/lib/journey/landing-provider-search';
import type { LandingResultFilters } from '@/lib/journey/landing-result-labels';
import { countryName, type LandingCountryCode } from '@/lib/journey/landing-route-model';

const ASIA_PACIFIC: LandingCountryCode[] = [
  'AU',
  'ID',
  'SG',
  'NZ',
  'JP',
  'IN',
  'PH',
  'MY',
  'HK',
  'TH',
  'VN',
];

export function formatIntelligenceSnapshot(date = PAYMENT_INTELLIGENCE_SNAPSHOT_DATE): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

export function intelligenceSnapshotLabel(date = PAYMENT_INTELLIGENCE_SNAPSHOT_DATE): string {
  return `Payment intelligence · snapshot ${formatIntelligenceSnapshot(date)}`;
}

function itemTouchesCountry(item: PaymentIntelligenceItem, code: LandingCountryCode): boolean {
  if (item.countries.includes(code)) return true;
  return item.corridors.some((corridor) => {
    if (corridor === 'cross_border') return true;
    return corridor.origin === code || corridor.destination === code;
  });
}

function itemScore(item: PaymentIntelligenceItem, query: PaymentIntelligenceQuery): number {
  let score = 10;
  if (item.countries.includes(query.origin)) score += 24;
  if (item.countries.includes(query.destination)) score += 16;
  if (item.corridors.includes('cross_border') && query.origin !== query.destination) score += 12;
  if (query.scope === 'australia' && item.countries.includes('AU')) score += 18;
  if (query.scope === 'asia_pacific' && item.countries.some((code) => ASIA_PACIFIC.includes(code))) {
    score += 12;
  }
  if (query.scope === 'cross_border' && item.corridors.includes('cross_border')) score += 10;
  if (query.scope === 'business' && (item.topic === 'fx' || item.topic === 'provider' || item.topic === 'regulation')) {
    score += 8;
  }
  score += Math.max(0, 20 - daysSince(item.publishedAt));
  return score;
}

function daysSince(isoDate: string): number {
  const then = Date.parse(`${isoDate}T00:00:00Z`);
  const now = Date.parse(`${PAYMENT_INTELLIGENCE_SNAPSHOT_DATE}T00:00:00Z`);
  return Math.round((now - then) / 86_400_000);
}

export function rankPaymentIntelligence(
  query: PaymentIntelligenceQuery,
  items: PaymentIntelligenceItem[] = PAYMENT_INTELLIGENCE_FEED
): RankedPaymentIntelligence {
  const ranked = [...items]
    .map((item) => ({ item, score: itemScore(item, query) }))
    .sort((left, right) => right.score - left.score || right.item.publishedAt.localeCompare(left.item.publishedAt))
    .map((entry) => entry.item);

  const watching = watchingThemes(query, ranked);

  return {
    query,
    snapshotDate: PAYMENT_INTELLIGENCE_SNAPSHOT_DATE,
    snapshotLabel: intelligenceSnapshotLabel(),
    items: ranked,
    pulse: ranked,
    watching,
  };
}

function watchingThemes(
  query: PaymentIntelligenceQuery,
  items: PaymentIntelligenceItem[]
): { title: string; detail: string }[] {
  const destination = countryName(query.destination);
  const origin = countryName(query.origin);
  const themes = [
    {
      title: 'FX',
      detail: `Indicative conversion and fee differences still shape ${origin} → ${destination} payouts.`,
    },
    {
      title: 'Settlement speed',
      detail:
        items.some((item) => item.topic === 'correspondent_banking')
          ? 'Bank frameworks and alternative rails are changing how long a cross-border payment can take.'
          : 'Arrival time still varies widely between bank, specialist FX and digital-settlement routes.',
    },
    {
      title: 'Regulatory / rail availability',
      detail:
        query.origin === 'AU' || query.destination === 'AU'
          ? 'Australian payments regulation and A2A work could change which methods become more competitive.'
          : 'Rail choice depends on what both sides can actually receive — that is not confirmed here.',
    },
  ];
  return themes;
}

export function watchlistForScope(scope: PaymentWatchScope): PaymentRailWatchItem[] {
  return PAYMENT_RAIL_WATCHLIST.filter((item) => item.scopes.includes(scope) || item.scopes.includes('all'))
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

export function developmentsForAdvisor(
  query: PaymentIntelligenceQuery,
  limit = 3
): Array<Pick<PaymentIntelligenceItem, 'id' | 'headline' | 'businessImpact' | 'provider'>> {
  return rankPaymentIntelligence(query).items.slice(0, limit).map((item) => ({
    id: item.id,
    headline: item.headline,
    businessImpact: item.businessImpact,
    provider: item.provider,
  }));
}

export function itemTouchesCorridor(
  item: PaymentIntelligenceItem,
  origin: LandingCountryCode,
  destination: LandingCountryCode
): boolean {
  return itemTouchesCountry(item, origin) || itemTouchesCountry(item, destination);
}

export const PAYMENT_SIGNAL_LABELS: Record<PaymentIntelligenceSignal, string> = {
  regulatory_momentum: 'Regulatory momentum',
  corridor_expansion: 'Corridor expansion',
  provider_adoption: 'Provider / bank adoption',
  availability_change: 'Availability change',
  regulatory_uncertainty: 'Regulatory uncertainty',
  no_material_change: 'No material change',
};

export function corridorFit(
  item: PaymentIntelligenceItem,
  origin: LandingCountryCode,
  destination: LandingCountryCode
): 'direct' | 'cross_border' | 'adjacent' {
  if (item.countries.includes(origin) || item.countries.includes(destination)) return 'direct';
  if (item.corridors.includes('cross_border') && origin !== destination) return 'cross_border';
  return 'adjacent';
}

export function findIntelligenceItem(id: string | null | undefined): PaymentIntelligenceItem | null {
  if (!id) return null;
  return PAYMENT_INTELLIGENCE_FEED.find((item) => item.id === id) ?? null;
}

export function searchHintForItem(item: PaymentIntelligenceItem): PaymentIntelligenceSearchHint {
  switch (item.topic) {
    case 'correspondent_banking':
    case 'bank_transfer':
      return { paymentMethods: ['bank_transfer'], priority: null };
    case 'card':
    case 'payment_link':
      return { paymentMethods: ['card', 'payment_link'], priority: null };
    case 'digital_dollar':
      return { paymentMethods: ['stablecoin'], priority: 'fastest' };
    default:
      return { paymentMethods: [], priority: null };
  }
}

export function filtersFromSearchHint(hint: PaymentIntelligenceSearchHint): LandingResultFilters {
  return {
    ...EMPTY_LANDING_FILTERS,
    paymentMethods: hint.paymentMethods,
  };
}

export function thisMattersBecause(item: PaymentIntelligenceItem): string {
  return `This matters because ${item.businessImpact.charAt(0).toLowerCase()}${item.businessImpact.slice(1)}`;
}

export function corridorFitLabel(fit: ReturnType<typeof corridorFit>): string | null {
  if (fit === 'direct') return 'For this corridor';
  if (fit === 'cross_border') return 'Cross-border';
  return null;
}
