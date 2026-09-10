import type { LandingProviderId, LandingProviderOffering } from '@/lib/journey/landing-provider-catalog';
import type { LandingRouteId } from '@/lib/journey/landing-route-model';

/**
 * Provenance for a route-intelligence signal.
 * Do not add `live` until an external observation has a real observedAt.
 */
export type Provenance = 'curated' | 'indicative' | 'externally_sourced' | 'unavailable';

export type CatalogFreshness = 'catalog_snapshot';

/** Commercial party that exposes a product. Not a rail and not a mechanism. */
export type ProviderId = LandingProviderId;

export type Provider = {
  id: ProviderId;
  name: string;
};

/**
 * Generic route class used by rankLandingRoutes.
 * Distinct from Provider and from the underlying NetworkRail.
 */
export type MechanismId = LandingRouteId;

/**
 * Underlying payment network when known from a sourced field.
 * Phase 1 catalogue has no explicit rail field — use `unknown`.
 * Never infer a rail from a provider or product name.
 */
export type NetworkRailId =
  | 'swift'
  | 'npp'
  | 'visa'
  | 'mastercard'
  | 'apple_pay'
  | 'google_pay'
  | 'unknown';

export type CorridorClass = 'cross_border' | 'domestic' | 'all';

export type Corridor = {
  origin: string;
  destination: string;
};

export type CurrencyPair = {
  source: string;
  target: string;
};

/** What an offering can serve. Phase 1 encodes today's offeringApplies inputs. */
export type Capability = {
  corridorClass: CorridorClass;
  transactionTypes: 'all' | string[];
};

/**
 * Sourced corridor/currency/purpose fact. Not a ranking opinion.
 * Absence of a matching row means unspecified — never treat that as supported.
 */
export type CapabilityStatus = 'supported' | 'unsupported' | 'unspecified';

export type CapabilityFreshness = 'current' | 'dated' | 'stale' | 'unknown';

export type CapabilitySourceType =
  | 'provider_docs'
  | 'provider_help'
  | 'provider_marketing'
  | 'regulator'
  | 'industry_body';

export type CapabilityEvidence = {
  source: string;
  sourceUrl: string;
  sourceType: CapabilitySourceType;
  /** Official document date when the page states one. */
  publishedAt: string | null;
  /** Not recorded in Phase 2 — do not fabricate. */
  retrievedAt: null;
  /** Effective date called out by the source, if any. */
  asOf: string | null;
  notes: string;
  freshness: CapabilityFreshness;
  /** Optional future policy hook. Null means no Phase 2 expiry. */
  staleAfterDays: number | null;
};

export type CorridorCapability = {
  id: string;
  offeringId: string;
  providerId: ProviderId;
  mechanism: MechanismId;
  origin: string | null;
  destination: string | null;
  currencyPair: { source: string | null; target: string | null };
  transactionType: string | null;
  networkRails: NetworkRailId[];
  status: CapabilityStatus;
  evidence: CapabilityEvidence;
};

export type PricingSnapshot = {
  provenance: 'indicative';
  model: 'percent' | 'percent_plus_fixed' | 'fixed' | 'qualitative';
  percent?: number;
  fixed?: number;
  note: string;
  observedAt: null;
};

export type FXSnapshot = {
  provenance: 'indicative' | 'unavailable';
  label: string | null;
  rate: null;
  observedAt: null;
};

export type StatuspageComponentStatus =
  | 'operational'
  | 'degraded_performance'
  | 'partial_outage'
  | 'major_outage';

export type StatuspagePageIndicator = 'none' | 'minor' | 'major' | 'critical';

export type ObservationType = 'provider_operational_health' | 'provider_payment_incident';

export type ObservationSubjectKind = 'provider' | 'provider_component' | 'provider_incident';

/** Statuspage incident statuses. Do not invent values. */
export type StatuspageIncidentStatus =
  | 'investigating'
  | 'identified'
  | 'monitoring'
  | 'resolved'
  | 'postmortem';

/** Statuspage incident impact. Not a routing decision. */
export type StatuspageIncidentImpact = 'none' | 'minor' | 'major' | 'critical';

export type IncidentRouteRelevance = 'unknown';

/**
 * Structured route evidence supplied by a source. Never inferred from prose.
 * Absence of every field means the evaluator must return unknown for incidents.
 */
export type StructuredRouteEvidence = {
  sourceCurrency?: string | null;
  destinationCurrency?: string | null;
  origin?: string | null;
  destination?: string | null;
  corridor?: Corridor | null;
  currencyPair?: CurrencyPair | null;
  country?: string | null;
  routeId?: string | null;
};

export type RouteImpactStatus = 'affected' | 'not_affected' | 'unknown';

export type RouteImpactReason =
  | 'explicit_corridor_match'
  | 'explicit_corridor_mismatch'
  | 'explicit_currency_match'
  | 'explicit_currency_mismatch'
  | 'explicit_component_match'
  | 'provider_operational_health'
  | 'provider_mismatch'
  | 'no_structured_match'
  | 'insufficient_evidence'
  | 'stale_observation'
  | 'missing_observation'
  | 'non_payment_component'
  | 'unknown_component_dependency';

export type ObservationEvaluationFreshness = 'fresh' | 'stale' | 'missing';

export type RouteImpactSubject = {
  offeringId: string;
  providerId: ProviderId;
  corridor: Corridor;
  currencyPair: CurrencyPair | null;
};

export type HealthImpactEvaluation = {
  observationType: 'provider_operational_health';
  status: RouteImpactStatus;
  reason: RouteImpactReason;
  freshness: ObservationEvaluationFreshness;
  componentStatus: StatuspageComponentStatus | null;
  sourceUrl: string | null;
  observedAt: string | null;
  provenance: Provenance | null;
};

export type IncidentImpactEvaluation = {
  observationType: 'provider_payment_incident';
  incidentId: string;
  title: string;
  status: RouteImpactStatus;
  reason: RouteImpactReason;
  freshness: ObservationEvaluationFreshness;
  sourceUrl: string | null;
  observedAt: string | null;
  provenance: Provenance | null;
  routeRelevance: IncidentRouteRelevance;
};

/** Shadow-mode result. Not an eligibility or ranking decision. */
export type RouteImpactEvaluation = {
  mode: 'shadow';
  offeringId: string;
  providerId: ProviderId;
  corridor: Corridor;
  currencyPair: CurrencyPair | null;
  operationalHealth: HealthImpactEvaluation;
  incidents: IncidentImpactEvaluation[];
  overallImpact: RouteImpactStatus;
  overallReasons: RouteImpactReason[];
};

/**
 * Production operational-eligibility decision.
 * `unknown` must never be treated as ineligible.
 * Capability eligibility remains a separate boolean from evaluateOfferingCoverage.
 */
export type RouteEligibilityStatus = 'eligible' | 'ineligible' | 'unknown';

export type RouteEligibilityReason =
  | 'provider_major_outage'
  | 'provider_partial_outage'
  | 'structured_route_incident'
  | 'no_material_failure'
  | 'degraded_performance_not_excluded'
  | 'stale_observation'
  | 'missing_observation'
  | 'insufficient_confidence'
  | 'insufficient_evidence'
  | 'provider_mismatch'
  | 'non_payment_component'
  | 'unknown_component_dependency'
  | 'no_structured_match';

export type RouteEligibilityEvidence = HealthImpactEvaluation | IncidentImpactEvaluation;

export type RouteEligibilityDecision = {
  offeringId: string;
  providerId: ProviderId;
  status: RouteEligibilityStatus;
  reasons: RouteEligibilityReason[];
  evidence: RouteEligibilityEvidence[];
};

export type ObservationConfidence = 'high' | 'unavailable';

export type ObservationFreshness = 'current' | 'stale' | 'unavailable';

/** Source-reported health. Not a binary available/unavailable judgement. */
export type ProviderOperationalHealthValue = {
  pageIndicator: StatuspagePageIndicator;
  pageDescription: string;
  componentId: string;
  componentName: string;
  componentStatus: StatuspageComponentStatus;
};

/**
 * Time-stamped external observation. Distinct from capability and from ranking.
 * externally_sourced requires observedAt, fetchedAt, sourceId, and sourceUrl.
 */
export type ProviderOperationalHealthObservation = {
  observationType: 'provider_operational_health';
  subjectKind: 'provider_component';
  subjectId: string;
  providerId: ProviderId;
  value: ProviderOperationalHealthValue;
  observedAt: string;
  fetchedAt: string;
  sourceId: string;
  sourceUrl: string;
  provenance: 'externally_sourced';
  confidence: 'high';
  staleAfter: string;
  rawHash: string;
  rawEvidence: {
    pageUpdatedAt: string;
    pageIndicator: StatuspagePageIndicator;
    pageDescription: string;
    componentId: string;
    componentName: string;
    componentStatus: StatuspageComponentStatus;
  };
};

export type ProviderPaymentIncidentValue = {
  incidentId: string;
  status: StatuspageIncidentStatus;
  impact: StatuspageIncidentImpact;
  title: string;
  /** Latest official update body. Source text — not a corridor/currency claim. */
  description: string;
  startedAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  affectedComponentIds: string[];
  affectedComponentNames: string[];
  latestUpdateId: string | null;
  latestUpdateStatus: StatuspageIncidentStatus | null;
  /** Statuspage does not provide structured corridor/currency fields. */
  routeRelevance: IncidentRouteRelevance;
  /** Explicit source fields only. Adapter leaves this null. */
  structuredRoute: StructuredRouteEvidence | null;
};

export type ProviderPaymentIncidentObservation = {
  observationType: 'provider_payment_incident';
  subjectKind: 'provider_incident';
  subjectId: string;
  providerId: ProviderId;
  value: ProviderPaymentIncidentValue;
  observedAt: string;
  fetchedAt: string;
  sourceId: string;
  sourceUrl: string;
  provenance: 'externally_sourced';
  confidence: 'high';
  staleAfter: string;
  rawHash: string;
  rawEvidence: {
    incidentId: string;
    status: StatuspageIncidentStatus;
    impact: StatuspageIncidentImpact;
    title: string;
    description: string;
    startedAt: string;
    updatedAt: string;
    resolvedAt: string | null;
    affectedComponentIds: string[];
    affectedComponentNames: string[];
    latestUpdateId: string | null;
  };
};

export type LatestObservationRead =
  | { kind: 'current'; observation: ProviderOperationalHealthObservation }
  | { kind: 'stale'; observation: ProviderOperationalHealthObservation }
  | { kind: 'unavailable'; reason: 'missing' | 'invalid' };

export type IndicativeAvailabilitySignal = {
  provenance: 'indicative';
  type: 'typical';
  observedAt: null;
};

export type ObservedAvailabilitySignal = {
  provenance: 'externally_sourced';
  type: 'observed';
  observedAt: string;
  sourceUrl: string;
  componentStatus: StatuspageComponentStatus;
  pageIndicator: StatuspagePageIndicator;
  freshness: 'current';
};

export type UnobservedAvailabilitySignal = {
  provenance: 'unavailable';
  type: 'unobserved';
  observedAt: null;
  reason: 'missing' | 'stale' | 'invalid';
};

export type AvailabilitySignal =
  | IndicativeAvailabilitySignal
  | ObservedAvailabilitySignal
  | UnobservedAvailabilitySignal;

export type SettlementSignal = {
  provenance: 'indicative';
  speedBand: string;
  arrivalLabel: string;
  observedAt: null;
};

/** Provider product mapped onto a mechanism. Source: LANDING_PROVIDER_OFFERINGS. */
export type Offering = {
  id: string;
  provider: Provider;
  productName: string;
  mechanism: MechanismId;
  corridorClass: CorridorClass;
  capability: Capability;
  networkRails: NetworkRailId[];
  pricing: PricingSnapshot;
  fx: FXSnapshot;
  availability: AvailabilitySignal;
  settlement: SettlementSignal;
  priorityAdj: { lowest_cost: number; fastest: number; simplest: number };
  live: false;
  provenance: 'curated';
  source: 'static_catalog';
};

/**
 * An offering applied to a corridor (and optional currency pair).
 * Phase 1 does not persist query-specific routes on the public snapshot.
 */
export type Route = {
  offeringId: string;
  providerId: ProviderId;
  mechanism: MechanismId;
  corridor: Corridor;
  currencyPair: CurrencyPair | null;
  networkRails: NetworkRailId[];
};

export type RouteEvidence = {
  signalType: 'pricing' | 'fx' | 'availability' | 'settlement' | 'regulatory' | 'catalog';
  provenance: Provenance;
  sourceRef: string;
  observedAt: null;
};

export type RouteConfidence = {
  level: 'Moderate';
  provenance: 'curated';
  reasons: string[];
};

/**
 * Curated development in payment infrastructure — not a route and not a rank input.
 */
export type RegulatorySignal = {
  id: string;
  publishedAt: string;
  source: string;
  sourceUrl: string;
  headline: string;
  summary: string;
  businessImpact: string;
  countries: string[];
  corridors: Array<Corridor | 'cross_border'>;
  relatedProviderIds: ProviderId[];
  relatedNetworkRails: NetworkRailId[];
  provenance: 'curated';
  freshness: CatalogFreshness;
  confidence: 'catalog';
};

/**
 * Public snapshot. Catalog/static by default — not a live retrieval.
 * Observations are attached from a prior read, never fetched here.
 */
export type PublicRouteIntelligenceSnapshot = {
  kind: 'catalog_static' | 'catalog_plus_observations';
  catalogUpdated: string;
  intelligenceSnapshotDate: string;
  freshness: CatalogFreshness;
  provenance: 'curated';
  offerings: Offering[];
  catalogOfferings: readonly LandingProviderOffering[];
  developments: RegulatorySignal[];
  capabilities: CorridorCapability[];
  observations: ProviderOperationalHealthObservation[];
  /** Active incidents that affect the Payments component. Not a ranking input. */
  incidents: ProviderPaymentIncidentObservation[];
  /** Active incidents that do not affect Payments (Website, API, etc.). */
  otherIncidents: ProviderPaymentIncidentObservation[];
  /** Shadow-mode route-impact evaluations. Never consumed by ranking. */
  routeImpacts: RouteImpactEvaluation[];
  /** Operational eligibility decisions. Empty unless evaluateRoutes is supplied. */
  eligibilityDecisions: RouteEligibilityDecision[];
};

export type PublicRouteIntelligenceSnapshotInput = {
  /** Preloaded read of Wise Payments health. Omitted = leave catalogue availability indicative. */
  wisePaymentsHealth?: LatestObservationRead;
  /** Preloaded latest incident observations. Omitted = none attached. */
  wiseIncidents?: ProviderPaymentIncidentObservation[];
  /** Optional subjects to evaluate in shadow mode. Public comparison omits this. */
  evaluateRoutes?: RouteImpactSubject[];
  /** Evaluation clock for freshness. Tests only — omit in production. */
  now?: Date;
};
