import type { LandingCountryCode } from '@/lib/journey/landing-route-model';

export type PaymentIntelligenceSourceType =
  | 'central_bank'
  | 'payment_network'
  | 'regulator'
  | 'industry_body'
  | 'provider';

export type PaymentIntelligenceTopic =
  | 'regulation'
  | 'bank_transfer'
  | 'correspondent_banking'
  | 'local_payout'
  | 'card'
  | 'payment_link'
  | 'digital_dollar'
  | 'instant_payment'
  | 'fx'
  | 'provider';

export type PaymentRailId =
  | 'wise'
  | 'airwallex'
  | 'ofx'
  | 'stripe'
  | 'paypal'
  | 'swift'
  | 'visa'
  | 'mastercard'
  | 'apple_pay'
  | 'google_pay'
  | 'npp'
  | 'bank'
  | 'digital_dollar'
  | 'rba';

export type PaymentRailStatus = 'watching' | 'changing' | 'emerging' | 'active';

export type PaymentIntelligenceSignal =
  | 'regulatory_momentum'
  | 'corridor_expansion'
  | 'provider_adoption'
  | 'availability_change'
  | 'regulatory_uncertainty'
  | 'no_material_change';

export type PaymentIntelligenceSearchHint = {
  paymentMethods: Array<
    | 'bank_transfer'
    | 'card'
    | 'payment_link'
    | 'digital_wallet'
    | 'stablecoin'
    | 'local_rail'
    | 'other'
  >;
  priority: 'lowest_cost' | 'fastest' | 'simplest' | null;
};

export type PaymentWatchScope = 'all' | 'australia' | 'asia_pacific' | 'cross_border' | 'business';

export type PaymentIntelligenceItem = {
  id: string;
  publishedAt: string;
  source: string;
  sourceUrl: string;
  sourceType: PaymentIntelligenceSourceType;
  provider: string;
  rails: PaymentRailId[];
  countries: LandingCountryCode[];
  corridors: Array<{ origin: LandingCountryCode; destination: LandingCountryCode } | 'cross_border'>;
  topic: PaymentIntelligenceTopic;
  headline: string;
  summary: string;
  businessImpact: string;
  relevance: string[];
  confidence: 'catalog';
  freshness: 'catalog_snapshot';
  status: PaymentRailStatus;
  signal: PaymentIntelligenceSignal;
  pulseLabel: string;
};

export type PaymentRailWatchItem = {
  id: PaymentRailId;
  rank: number;
  name: string;
  category: string;
  lens: string;
  reason: string;
  status: PaymentRailStatus;
  movement: 'up' | 'down' | 'steady';
  movementReason: string | null;
  scopes: PaymentWatchScope[];
};

export type PaymentIntelligenceQuery = {
  origin: LandingCountryCode;
  destination: LandingCountryCode;
  scope: PaymentWatchScope;
};

export type RankedPaymentIntelligence = {
  query: PaymentIntelligenceQuery;
  snapshotDate: string;
  snapshotLabel: string;
  items: PaymentIntelligenceItem[];
  pulse: PaymentIntelligenceItem[];
  watching: { title: string; detail: string }[];
};
