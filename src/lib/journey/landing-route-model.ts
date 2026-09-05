import { WORKSPACE_CURRENCIES } from '@/lib/currency/workspace-currencies';

export const LANDING_TRANSACTION_TYPES = [
  {
    id: 'supplier_payment',
    label: 'Supplier payment',
    objective: 'reduce-admin',
  },
  {
    id: 'customer_collection',
    label: 'Customer collection',
    objective: 'paid-faster',
  },
  {
    id: 'contractor_payroll',
    label: 'Contractor / payroll',
    objective: 'reduce-admin',
  },
  {
    id: 'revenue_share',
    label: 'Revenue share',
    objective: 'revenue-share',
  },
  {
    id: 'intercompany',
    label: 'Intercompany',
    objective: 'reporting',
  },
] as const;

export const LANDING_PRIORITIES = [
  { id: 'lowest_cost', label: 'Lowest total cost' },
  { id: 'fastest', label: 'Fastest' },
  { id: 'simplest', label: 'Simplest' },
] as const;

export const LANDING_COUNTRIES = [
  { code: 'AU', name: 'Australia' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'JP', name: 'Japan' },
  { code: 'CA', name: 'Canada' },
  { code: 'DE', name: 'Germany' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'IN', name: 'India' },
  { code: 'PH', name: 'Philippines' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' },
] as const;

export const LANDING_CURRENCIES = WORKSPACE_CURRENCIES;

export type LandingTransactionTypeId = (typeof LANDING_TRANSACTION_TYPES)[number]['id'];
export type LandingPriorityId = (typeof LANDING_PRIORITIES)[number]['id'];
export type LandingCountryCode = (typeof LANDING_COUNTRIES)[number]['code'];
export type LandingRouteId =
  | 'domestic_bank'
  | 'international_bank'
  | 'card_checkout'
  | 'local_currency_settlement'
  | 'stablecoin_settlement'
  | 'direct_debit';

export type LandingSearchQuery = {
  originCountry: LandingCountryCode;
  destinationCountry: LandingCountryCode;
  amount: number;
  currency: string;
  transactionType: LandingTransactionTypeId;
  priority: LandingPriorityId;
};

export type LandingComparedRoute = {
  id: LandingRouteId;
  name: string;
  summary: string;
  costLabel: string;
  speedLabel: string;
  operationalEffortLabel: string;
  bestWhen: string;
  chooseWhen: string;
  tradeoff: string;
  isGenericBest: boolean;
};

export const LANDING_COMPARISON_DISCLAIMER =
  'Typical route characteristics for this payment — not live quotes, live FX, or advice for a specific business.';

export const LANDING_CONTEXT_SIGNALS = [
  'cash position',
  'payment history',
  'invoices and obligations',
  'agreements / payment terms',
  'connected payment rails',
  'FX exposure',
  'approval requirements',
  'existing workflows',
] as const;

export const DEFAULT_LANDING_SEARCH: LandingSearchQuery = {
  originCountry: 'AU',
  destinationCountry: 'ID',
  amount: 10000,
  currency: 'AUD',
  transactionType: 'supplier_payment',
  priority: 'lowest_cost',
};

export function isLandingCountryCode(value: string): value is LandingCountryCode {
  return LANDING_COUNTRIES.some((country) => country.code === value);
}

export function isLandingTransactionTypeId(value: string): value is LandingTransactionTypeId {
  return LANDING_TRANSACTION_TYPES.some((type) => type.id === value);
}

export function isLandingPriorityId(value: string): value is LandingPriorityId {
  return LANDING_PRIORITIES.some((priority) => priority.id === value);
}

export function countryName(code: LandingCountryCode): string {
  return LANDING_COUNTRIES.find((country) => country.code === code)?.name ?? code;
}

export function transactionTypeLabel(id: LandingTransactionTypeId): string {
  return LANDING_TRANSACTION_TYPES.find((type) => type.id === id)?.label ?? id;
}

export function priorityLabel(id: LandingPriorityId): string {
  return LANDING_PRIORITIES.find((priority) => priority.id === id)?.label ?? id;
}

export function objectiveFromLandingSearch(query: LandingSearchQuery): string {
  return (
    LANDING_TRANSACTION_TYPES.find((type) => type.id === query.transactionType)?.objective ??
    'other'
  );
}

export function formatLandingAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency,
      maximumFractionDigits: amount >= 100 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export function parseLandingAmount(value: string): number | null {
  const parsed = Number(value.replace(/,/g, '').trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function isDomestic(query: LandingSearchQuery): boolean {
  return query.originCountry === query.destinationCountry;
}

export function landingSearchIsValid(query: LandingSearchQuery): boolean {
  return (
    isLandingCountryCode(query.originCountry) &&
    isLandingCountryCode(query.destinationCountry) &&
    Number.isFinite(query.amount) &&
    query.amount > 0 &&
    LANDING_CURRENCIES.some((currency) => currency.code === query.currency) &&
    isLandingTransactionTypeId(query.transactionType) &&
    isLandingPriorityId(query.priority)
  );
}
