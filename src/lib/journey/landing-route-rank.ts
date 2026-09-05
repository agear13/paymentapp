import { isDomestic, type LandingPriorityId, type LandingRouteId, type LandingSearchQuery, type LandingTransactionTypeId } from '@/lib/journey/landing-route-model';

/**
 * Illustrative scores for typical route characteristics — not live quotes,
 * availability, or a specific business's rates. Replace or enrich later with
 * corridor, pricing, rail and connected-context intelligence.
 */
const PRIORITY_SCORES: Record<LandingPriorityId, Record<LandingRouteId, number>> = {
  lowest_cost: {
    domestic_bank: 96,
    international_bank: 78,
    card_checkout: 38,
    local_currency_settlement: 74,
    stablecoin_settlement: 70,
    direct_debit: 86,
  },
  fastest: {
    domestic_bank: 58,
    international_bank: 42,
    card_checkout: 94,
    local_currency_settlement: 68,
    stablecoin_settlement: 90,
    direct_debit: 52,
  },
  simplest: {
    domestic_bank: 90,
    international_bank: 72,
    card_checkout: 92,
    local_currency_settlement: 54,
    stablecoin_settlement: 28,
    direct_debit: 70,
  },
};

const TYPE_ADJUSTMENT: Record<LandingTransactionTypeId, Partial<Record<LandingRouteId, number>>> = {
  supplier_payment: {
    card_checkout: -24,
    direct_debit: -20,
    international_bank: 6,
    domestic_bank: 6,
  },
  customer_collection: {
    card_checkout: 10,
    direct_debit: 8,
    stablecoin_settlement: -8,
  },
  contractor_payroll: {
    card_checkout: -20,
    direct_debit: -16,
    domestic_bank: 8,
  },
  revenue_share: {
    card_checkout: 8,
    local_currency_settlement: 6,
  },
  intercompany: {
    card_checkout: -18,
    direct_debit: -18,
    local_currency_settlement: 8,
    international_bank: 4,
  },
};

const ALL_ROUTE_IDS: LandingRouteId[] = [
  'domestic_bank',
  'international_bank',
  'card_checkout',
  'local_currency_settlement',
  'stablecoin_settlement',
  'direct_debit',
];

function routeApplies(id: LandingRouteId, query: LandingSearchQuery, domestic: boolean): boolean {
  switch (id) {
    case 'domestic_bank':
      return domestic;
    case 'international_bank':
      return !domestic;
    case 'card_checkout':
      return true;
    case 'local_currency_settlement':
      return !domestic;
    case 'stablecoin_settlement':
      return true;
    case 'direct_debit':
      return query.transactionType === 'customer_collection' && domestic;
    default:
      return false;
  }
}

function scoreRoute(id: LandingRouteId, query: LandingSearchQuery): number {
  const base = PRIORITY_SCORES[query.priority][id];
  const adjustment = TYPE_ADJUSTMENT[query.transactionType][id] ?? 0;
  return Math.max(0, Math.min(100, base + adjustment));
}

/** Deterministic ranking used by the public comparison. Extension point for later live intelligence. */
export function rankLandingRoutes(
  query: LandingSearchQuery
): { id: LandingRouteId; score: number }[] {
  const domestic = isDomestic(query);
  return ALL_ROUTE_IDS.filter((id) => routeApplies(id, query, domestic))
    .map((id) => ({ id, score: scoreRoute(id, query) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
