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
 * Opaque rail identifier. Catalogue IDs live in NETWORK_RAIL_CATALOGUE.
 * `unknown` means no sourced rail — never invent SWIFT from international_bank.
 * Not a closed country or market enum; new rails do not require a type change.
 */
export type NetworkRailId = string;

/** ISO 3166-style country code. Not a closed Australia/SEA/US enum. */
export type JurisdictionCode = string;

/**
 * Primary classification of a network rail.
 * A rail may also carry additional classifications; mechanism ≠ rail.
 */
export type NetworkRailType =
  | 'domestic_payment'
  | 'cross_border_payment'
  | 'card_network'
  | 'bank_messaging'
  | 'account_to_account'
  | 'instant_payment'
  | 'other';

export type CorridorKind = 'domestic' | 'cross_border';

export type RailCapabilityStatus = 'supported' | 'unsupported' | 'restricted' | 'unknown';

export type RegulatoryStatus =
  | 'permitted'
  | 'restricted'
  | 'prohibited'
  | 'required'
  | 'changed'
  | 'unknown';

/**
 * Canonical payment-network rail. Distinct from Provider and Mechanism.
 * Do not infer a rail from provider marketing language.
 */
export type NetworkRail = {
  id: NetworkRailId;
  name: string;
  operator: string;
  railType: NetworkRailType;
  additionalTypes: NetworkRailType[];
  jurisdictions: JurisdictionCode[];
  currencies: string[];
  evidence: CapabilityEvidence;
};

/**
 * Whether a rail can carry a payment shape.
 * restricted must not collapse into unsupported.
 * unknown must not collapse into supported.
 */
export type RailCapability = {
  id: string;
  railId: NetworkRailId;
  originCountry: JurisdictionCode | null;
  destinationCountry: JurisdictionCode | null;
  sourceCurrency: string | null;
  destinationCurrency: string | null;
  paymentType: string | null;
  corridorKind: CorridorKind | null;
  participantRequirements: string[];
  status: RailCapabilityStatus;
  evidence: CapabilityEvidence;
};

/**
 * Explicit Provider → Offering → Mechanism → Network Rail link.
 * Populate only when evidence supports the relationship.
 */
export type OfferingRailMapping = {
  id: string;
  providerId: ProviderId;
  offeringId: string;
  mechanismId: MechanismId;
  railId: NetworkRailId;
  corridor: Corridor | null;
  currencyPair: { source: string | null; target: string | null } | null;
  evidence: CapabilityEvidence | null;
};

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

/** Catalog indicative fee. Not a provider_fee_observation and not ranked from. */
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

export type ObservationType =
  | 'provider_operational_health'
  | 'provider_payment_incident'
  | 'provider_fee_observation'
  | 'rail_regulatory_observation';

export type ObservationSubjectKind =
  | 'provider'
  | 'provider_component'
  | 'provider_incident'
  | 'route'
  | 'rail';

/**
 * Canonical payment-route identity.
 * Amount is not part of this identity — it belongs on economic observations.
 * networkRail may be `unknown` when no sourced rail exists; do not invent one.
 * currencyPair.target is null when the destination currency is unknown.
 * Do not infer a currency from a country (Indonesia ≠ IDR).
 */
export type RouteSubject = {
  providerId: ProviderId;
  offeringId: string;
  mechanismId: MechanismId;
  corridor: Corridor;
  currencyPair: { source: string | null; target: string | null };
  networkRail: NetworkRailId;
};

export type FeeModel = 'fixed' | 'percentage' | 'tiered' | 'unknown';

export type ProviderFeeObservationValue = {
  route: RouteSubject;
  /** Quote amount. Null means the observation is not amount-specific. */
  amount: number | null;
  sourceCurrency: string | null;
  feeAmount: number | null;
  feeCurrency: string | null;
  feeModel: FeeModel;
  feePercent: number | null;
};

/**
 * Time-stamped fee observation. Not catalog PricingSnapshot and not a rank input.
 * Must not be populated from indicative catalogue fees.
 */
export type ProviderFeeObservation = {
  observationType: 'provider_fee_observation';
  subjectKind: 'route';
  subjectId: string;
  providerId: ProviderId;
  value: ProviderFeeObservationValue;
  observedAt: string;
  fetchedAt: string;
  sourceId: string;
  sourceUrl: string;
  provenance: 'externally_sourced';
  confidence: 'high';
  staleAfter: string;
  rawHash: string;
  rawEvidence: {
    routeKey: string;
    amount: number | null;
    sourceCurrency: string | null;
    feeAmount: number | null;
    feeCurrency: string | null;
    feeModel: FeeModel;
    feePercent: number | null;
  };
};

export type RailRegulatoryObservationValue = {
  railId: NetworkRailId;
  jurisdiction: JurisdictionCode | null;
  paymentType: string | null;
  currency: string | null;
  participantType: string | null;
  status: RegulatoryStatus;
  effectiveFrom: string | null;
  effectiveTo: string | null;
};

/**
 * Structured regulatory state — not a news headline.
 * Do not create this from prose such as "Indonesia is considering changes".
 * Only authoritative / explicitly structured source data.
 */
export type RailRegulatoryObservation = {
  observationType: 'rail_regulatory_observation';
  subjectKind: 'rail';
  subjectId: string;
  /** Provider-agnostic. Stored as `none` in the shared observation table. */
  providerId: null;
  value: RailRegulatoryObservationValue;
  observedAt: string;
  fetchedAt: string;
  sourceId: string;
  sourceUrl: string;
  provenance: 'externally_sourced' | 'curated';
  confidence: ObservationConfidence;
  staleAfter: string;
  rawHash: string;
  rawEvidence: {
    railId: NetworkRailId;
    jurisdiction: JurisdictionCode | null;
    paymentType: string | null;
    currency: string | null;
    participantType: string | null;
    status: RegulatoryStatus;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    source: string;
  };
};

/** @see RailRegulatoryObservation */
export type RegulatoryObservation = RailRegulatoryObservation;

export type RegulatoryEvaluationContext = {
  paymentType?: string | null;
  participantType?: string | null;
  now?: Date;
};

/** Shadow-only. Never an eligibility or ranking decision. */
export type RegulatoryImpactEvaluation = {
  mode: 'shadow';
  observationType: 'rail_regulatory_observation';
  offeringId: string;
  providerId: ProviderId;
  corridor: Corridor;
  currencyPair: { source: string | null; target: string | null };
  networkRail: NetworkRailId;
  observationSubjectId: string | null;
  railId: NetworkRailId | null;
  status: RouteImpactStatus;
  reason: RouteImpactReason;
  freshness: ObservationEvaluationFreshness;
  regulatoryStatus: RegulatoryStatus | null;
  sourceUrl: string | null;
  observedAt: string | null;
  provenance: Provenance | null;
};

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
  | 'unknown_component_dependency'
  | 'rail_match'
  | 'rail_mismatch'
  | 'unknown_route_rail'
  | 'regulatory_prohibited'
  | 'regulatory_restricted'
  | 'jurisdiction_mismatch'
  | 'payment_type_mismatch'
  | 'participant_type_mismatch'
  | 'currency_mismatch'
  | 'outside_effective_window';

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
  /**
   * Shadow-only fee observations. Never consumed by ranking or eligibility.
   * Empty unless the caller supplies them — public comparison does not.
   */
  feeObservations: ProviderFeeObservation[];
  /** Canonical network-rail catalogue. Not a ranking input. */
  networkRails: NetworkRail[];
  /** Rail capability facts. Distinct from offering CorridorCapability. */
  railCapabilities: RailCapability[];
  /**
   * Explicit offering→rail links. Empty until evidence supports a mapping.
   * Do not infer Wise=SWIFT or Bank=NPP.
   */
  offeringRailMappings: OfferingRailMapping[];
  /**
   * Structured regulatory state. Not curated news/developments.
   * Empty unless the caller supplies them — public comparison does not.
   */
  regulatoryObservations: RailRegulatoryObservation[];
  /**
   * Shadow-only regulatory route-impact evaluations.
   * Never consumed by ranking or eligibility.
   */
  regulatoryImpacts: RegulatoryImpactEvaluation[];
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
  /** Preloaded fee observations. Omitted = none attached. Not fetched here. */
  feeObservations?: ProviderFeeObservation[];
  /** Preloaded structured regulatory observations. Omitted = none attached. */
  regulatoryObservations?: RailRegulatoryObservation[];
  /** Optional RouteSubjects for shadow regulatory evaluation. Public comparison omits this. */
  evaluateRouteSubjects?: RouteSubject[];
  /** Payment type for shadow regulatory evaluation. Omitted = unknown when the observation is type-specific. */
  regulatoryPaymentType?: string | null;
  /** Participant type for shadow regulatory evaluation. */
  regulatoryParticipantType?: string | null;
};
