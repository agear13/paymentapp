import type { RecommendationExplanation } from '@/lib/route-intelligence';
import type {
  PaymentAdvisorParameterUsage,
  PaymentAdvisorPaymentContext,
} from '@/lib/advisor/payment-advisor-context';
import type { PaymentAdvisorIntentId } from '@/lib/advisor/payment-advisor-intents';

export type AdvisorPricingKind = 'indicative_catalogue' | 'live_connected' | 'unknown';

export type AdvisorOfferingSnapshot = {
  offeringId: string;
  providerId: string;
  providerName: string;
  productName: string;
  rank: number;
  isRecommended: boolean;
  pricing: {
    kind: AdvisorPricingKind;
    totalLabel: string;
    amount: number | null;
    live: boolean;
    sourceType: string;
    retrievedAt: string | null;
  };
  availability: {
    type: string;
    provenance: string;
  };
  whyShort: string;
};

export type AdvisorMonitoringIncident = {
  incidentId: string;
  title: string;
  status: string;
  impact: string;
  description: string;
  updatedAt: string;
  sourceId: string;
  sourceUrl: string;
};

export type AdvisorMonitoringSnapshot = {
  providerId: 'wise';
  componentName: string;
  status: 'unavailable' | 'stale' | 'current';
  componentStatus: string | null;
  pageDescription: string | null;
  observedAt: string | null;
  fetchedAt: string | null;
  staleAfter: string | null;
  freshness: {
    label: string;
    /** Observation window used by route intelligence (currently 3 hours). Not real-time. */
    maxAgeHours: number;
    isStale: boolean;
  };
  source: { id: string; url: string } | null;
  activePaymentIncidents: AdvisorMonitoringIncident[];
  otherIncidents: AdvisorMonitoringIncident[];
};

export type AdvisorDataFreshness = {
  snapshotKind: 'catalog_static' | 'catalog_plus_observations';
  catalogueUpdated: string;
  intelligenceSnapshotDate: string;
  pricingKind: AdvisorPricingKind;
  monitoringKind: 'monitored_operational' | 'unavailable';
  disclaimer: string;
};

export type AdvisorScenarioComparison = {
  scenarioProviderId: 'airwallex';
  scenarioOffering: AdvisorOfferingSnapshot | null;
  recommendedOffering: AdvisorOfferingSnapshot;
  comparedOfferings: AdvisorOfferingSnapshot[];
  scenarioIsRecommended: boolean;
};

export type PaymentAdvisorResponse = {
  intent: PaymentAdvisorIntentId;
  paymentContext: PaymentAdvisorPaymentContext;
  parameterUsage: PaymentAdvisorParameterUsage;
  recommendation: AdvisorOfferingSnapshot | null;
  alternatives: AdvisorOfferingSnapshot[];
  reasons: RecommendationExplanation['reasons'];
  tradeoffs: RecommendationExplanation['tradeoffs'];
  unknowns: RecommendationExplanation['unknowns'];
  explanation: Pick<
    RecommendationExplanation,
    'status' | 'summary' | 'confidence' | 'displayedOfferingId' | 'displayedProviderName'
  > | null;
  scenarioComparison: AdvisorScenarioComparison | null;
  monitoring: AdvisorMonitoringSnapshot | null;
  evidence: RecommendationExplanation['evidence'];
  dataFreshness: AdvisorDataFreshness;
  /** Plain-text summary for current UI; future LLM can ignore this. */
  answer: string;
};
