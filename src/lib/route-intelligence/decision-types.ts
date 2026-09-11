import type { LandingPriorityId } from '@/lib/journey/landing-route-model';
import type {
  CorridorCapability,
  EconomicFactState,
  LatestObservationRead,
  OfferingCoverage,
  ProviderFeeObservation,
  ProviderOperationalHealthObservation,
  ProviderPaymentIncidentObservation,
  RailRegulatoryObservation,
  RegulatoryImpactEvaluation,
  RouteAvailabilityObservation,
  RouteEconomicState,
  RouteEligibilityDecision,
  RouteFxObservation,
  RouteImpactEvaluation,
  RouteSettlementObservation,
  RouteSubject,
  TotalCostResult,
} from '@/lib/route-intelligence/types';

export type DecisionPriority = LandingPriorityId;

export type DecisionPayment = {
  origin: string;
  destination: string;
  sourceCurrency: string;
  destinationCurrency: string | null;
  amount: number;
  transactionType: string;
  priority: DecisionPriority;
};

export type DecisionCandidate = {
  route: RouteSubject;
};

export type DecisionIntelligence = {
  capabilities?: readonly CorridorCapability[];
  health?: LatestObservationRead | ProviderOperationalHealthObservation | null;
  incidents?: readonly ProviderPaymentIncidentObservation[];
  regulatoryObservations?: readonly RailRegulatoryObservation[];
  feeObservations?: readonly ProviderFeeObservation[];
  fxObservations?: readonly RouteFxObservation[];
  settlementObservations?: readonly RouteSettlementObservation[];
  availabilityObservations?: readonly RouteAvailabilityObservation[];
  now?: Date;
};

export type DecisionFactorKind =
  | 'total_economic_outcome'
  | 'explicit_fee'
  | 'fx_outcome'
  | 'settlement'
  | 'availability'
  | 'operational_health'
  | 'regulatory_state'
  | 'corridor_capability'
  | 'evidence_confidence'
  | 'freshness'
  | 'route_specificity';

export type DecisionFactor = {
  kind: DecisionFactorKind;
  state: EconomicFactState;
  summary: string;
  evidenceUrls: string[];
};

export type DecisionEvidenceRef = {
  label: string;
  sourceUrl: string;
};

export type DecisionConfidenceLevel = 'high' | 'moderate' | 'low' | 'unknown';

export type DecisionConfidence = {
  level: DecisionConfidenceLevel;
  reasons: string[];
};

export type RouteDecisionAssessment = {
  route: RouteSubject;
  recommendable: boolean;
  coverage: OfferingCoverage;
  eligibility: RouteEligibilityDecision;
  operational: RouteImpactEvaluation;
  regulatory: RegulatoryImpactEvaluation[];
  economic: RouteEconomicState;
  totalCost: TotalCostResult;
  factors: DecisionFactor[];
  positives: string[];
  tradeoffs: string[];
  unknowns: string[];
  evidenceRefs: DecisionEvidenceRef[];
};

export type RouteDecision = {
  mode: 'shadow';
  payment: DecisionPayment;
  recommended: RouteDecisionAssessment | null;
  alternatives: RouteDecisionAssessment[];
  confidence: DecisionConfidence;
  decisionNotes: string[];
};

export type RankingShadowRef = {
  recommendedOfferingId: string | null;
  orderedOfferingIds: string[];
};

export type ShadowDecisionComparison = {
  sameRecommendation: boolean;
  changedRecommendation: boolean;
  changedOrdering: boolean;
  insufficientEvidence: boolean;
  divergenceReasons: string[];
  rankingRecommendedOfferingId: string | null;
  decisionRecommendedOfferingId: string | null;
};
