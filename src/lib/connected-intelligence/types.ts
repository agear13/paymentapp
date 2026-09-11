import type { TotalCostResult } from '@/lib/route-intelligence/types';

export type WiseIntelligenceConsentState = {
  organizationId: string;
  connected: boolean;
  profilePresent: boolean;
  consented: boolean;
  consentedAt: string | null;
  revokedAt: string | null;
};

export type ConnectedWiseInsight = {
  organizationId: string;
  corridor: { origin: 'AU'; destination: 'ID' };
  currencyPair: { source: 'AUD'; target: 'IDR' };
  amount: number;
  wise: {
    status: 'known' | 'unknown' | 'unavailable';
    quoteId: string | null;
    sourceAmount: number | null;
    destinationAmount: number | null;
    feeAmount: number | null;
    feeCurrency: string | null;
    exchangeRate: number | null;
    rateKind: 'provider_quoted' | null;
    fetchedAt: string | null;
    observedAt: string | null;
    unknownReason: string | null;
  };
  reference: {
    status: 'known' | 'unavailable' | 'stale';
    exchangeRate: number | null;
    rateKind: 'mid_market_reference';
    label: 'RBA official AUD reference';
    observedAt: string | null;
  };
  totalCost: {
    state: TotalCostResult['state'];
    sourceAmount: number | null;
    explicitFeeAmount: number | null;
    destinationAmount: number | null;
    effectiveRate: number | null;
    reason: string | null;
  };
  interpretation: string[];
  unknowns: string[];
  comparableProvidersUnknown: true;
  publicRankingUnchanged: true;
  publicRecommendedOfferingId: string;
  shadowMode: 'shadow';
};
