import type { AgreementType } from './classify-agreement-type';
import { agreementTypeDisplayLabel } from './classify-agreement-type';
import type { CommercialGraphSnapshot } from './commercial-graph-types';
import type {
  ExtractedParty,
  ExtractedSettlementEvent,
  ExtractionConfidence,
  ExtractionReadinessAssessment,
  ExtractionResult,
  SettlementEventType,
} from './extraction-types';
import { formatCompensationTermLabel } from './migrate-extraction-schema';
import { hasFixedFeeAmount, hasRevenueSharePct } from './party-obligation-metrics';
import { deliverableDescriptions } from './parse-deliverables';
import { filterEvidenceBackedSettlementRules } from './parse-settlement-rules';
import {
  inferServiceCategoriesForParties,
  inferServiceCategoriesForParty,
} from './service-category-detection';
import {
  serviceCategoryDisplayLabel,
  type ServiceCategory,
} from './service-category';

export type PersistedDeliverable = {
  description: string;
  category: ServiceCategory | null;
  confidence: ExtractionConfidence;
};

export type PersistedOperationalObligation = {
  description: string;
  category: ServiceCategory | null;
  confidence: ExtractionConfidence;
};

export type PersistedCompensationTerm = {
  id: string;
  type: string;
  label: string;
  amount: number | null;
  percentage: number | null;
  trigger: string | null;
  confidence: ExtractionConfidence;
};

export type PersistedCommercialDependency = {
  description: string;
  type: string;
  blocksSettlement: boolean;
  relatedCompensationId: string | null;
};

export type PersistedFixedObligation = {
  amount: number | null;
  confidence: ExtractionConfidence;
};

export type PersistedRevenueShareObligation = {
  percentage: number | null;
  confidence: ExtractionConfidence;
};

export type PersistedConditionalPayment = {
  trigger: string;
  amount: number | null;
  confidence: ExtractionConfidence;
};

export type PersistedSettlementRule = {
  trigger: string;
  basis: string | null;
  confidence: ExtractionConfidence;
};

export type PersistedSettlementEvent = {
  type: SettlementEventType;
  amount: number | null;
  percentage: number | null;
  trigger: string | null;
  condition: string | null;
};

/** Participant obligation graph persisted into onboarding and audit records. */
export type ParticipantObligationGraph = {
  serviceCategories: ServiceCategory[];
  deliverables: PersistedDeliverable[];
  operationalObligations: PersistedOperationalObligation[];
  compensationTerms: PersistedCompensationTerm[];
  commercialDependencies: PersistedCommercialDependency[];
  /** @deprecated Use compensationTerms — retained for v4 consumers. */
  fixedObligations: PersistedFixedObligation[];
  /** @deprecated Use compensationTerms — retained for v4 consumers. */
  revenueShareObligations: PersistedRevenueShareObligation[];
  conditionalPayments: PersistedConditionalPayment[];
  settlementEvents: PersistedSettlementEvent[];
};

/** Deal-level obligation snapshot from extraction. */
export type ExtractionObligationSnapshot = {
  schemaVersion: 'v4' | 'v5';
  agreementType: AgreementType | null;
  agreementTypeLabel: string;
  agreementOwner: string | null;
  settlementRules: PersistedSettlementRule[];
  readinessAssessment?: ExtractionReadinessAssessment;
  serviceCategories: ServiceCategory[];
  commercialGraph?: CommercialGraphSnapshot;
};

function mapDeliverables(party: ExtractedParty): PersistedDeliverable[] {
  if ((party.deliverables ?? []).length > 0) {
    return party.deliverables
      .map((d) => ({
        description: d.description.value?.trim() ?? '',
        category: d.category.value ?? null,
        confidence: d.description.confidence,
      }))
      .filter((d) => d.description.length > 0);
  }

  const legacyConfidence = party.deliverablesLegacy?.confidence ?? 'medium';
  return deliverableDescriptions(party).map((description) => ({
    description,
    category: null,
    confidence: legacyConfidence,
  }));
}

function mapOperationalObligations(party: ExtractedParty): PersistedOperationalObligation[] {
  if (party.operationalObligations?.length) {
    return party.operationalObligations
      .map((o) => ({
        description: o.description.value?.trim() ?? '',
        category: o.category.value ?? null,
        confidence: o.description.confidence,
      }))
      .filter((o) => o.description.length > 0);
  }
  return mapDeliverables(party).map((d) => ({
    description: d.description,
    category: d.category,
    confidence: d.confidence,
  }));
}

function mapCompensationTerms(party: ExtractedParty): PersistedCompensationTerm[] {
  if (!party.compensationTerms?.length) return [];
  return party.compensationTerms.map((term) => ({
    id: term.id,
    type: term.type,
    label: formatCompensationTermLabel(term),
    amount: term.amount.value,
    percentage: term.percentage.value,
    trigger: term.trigger.value,
    confidence: term.confidence,
  }));
}

function mapCommercialDependencies(party: ExtractedParty): PersistedCommercialDependency[] {
  return (party.commercialDependencies ?? []).map((dep) => ({
    description: dep.description.value?.trim() ?? '',
    type: dep.type.value,
    blocksSettlement: dep.blocksSettlement.value,
    relatedCompensationId: dep.relatedCompensationId.value,
  }));
}

function mapSettlementEventsForParty(
  partyId: string,
  events: ExtractedSettlementEvent[] | undefined
): PersistedSettlementEvent[] {
  if (!events?.length) return [];
  return events
    .filter((event) => event.partyId.value === partyId)
    .map((event) => ({
      type: event.type.value,
      amount: event.amount.value,
      percentage: event.percentage.value,
      trigger: event.trigger.value,
      condition: event.condition.value,
    }));
}

export function mapPartyToObligationGraph(
  party: ExtractedParty,
  settlementEvents?: ExtractedSettlementEvent[]
): ParticipantObligationGraph {
  const graph: ParticipantObligationGraph = {
    serviceCategories: inferServiceCategoriesForParty(party),
    deliverables: mapDeliverables(party),
    operationalObligations: mapOperationalObligations(party),
    compensationTerms: mapCompensationTerms(party),
    commercialDependencies: mapCommercialDependencies(party),
    fixedObligations: [],
    revenueShareObligations: [],
    conditionalPayments: (party.conditionalPayments ?? [])
      .map((payment) => ({
        trigger: payment.trigger.value?.trim() ?? '',
        amount: payment.amount.value,
        confidence: payment.trigger.confidence,
      }))
      .filter((payment) => payment.trigger.length > 0),
    settlementEvents: mapSettlementEventsForParty(party.id, settlementEvents),
  };

  if (hasFixedFeeAmount(party)) {
    graph.fixedObligations.push({
      amount: party.fixedAmount.value,
      confidence: party.fixedAmount.confidence,
    });
  }

  if (hasRevenueSharePct(party)) {
    graph.revenueShareObligations.push({
      percentage: party.revenueSharePct.value,
      confidence: party.revenueSharePct.confidence,
    });
  }

  return graph;
}

export function mapExtractionToObligationSnapshot(
  result: ExtractionResult
): ExtractionObligationSnapshot {
  const agreementType = result.agreementType?.value ?? null;
  const settlementRules = filterEvidenceBackedSettlementRules(result.settlementRules ?? [])
    .map((rule) => ({
      trigger: rule.trigger.value?.trim() ?? '',
      basis: rule.basis.value,
      confidence: rule.trigger.confidence,
    }))
    .filter((rule) => rule.trigger.length > 0);

  const schemaVersion = result.schemaVersion === 'v5' ? 'v5' : 'v4';

  return {
    schemaVersion,
    agreementType,
    agreementTypeLabel: agreementType
      ? agreementTypeDisplayLabel(agreementType)
      : 'Collaboration Agreement',
    agreementOwner: result.agreementOwner?.name.value?.trim() ?? result.commercialGraph?.agreementOwner ?? null,
    settlementRules,
    readinessAssessment: result.readinessAssessment,
    serviceCategories: inferServiceCategoriesForParties(result.parties),
    commercialGraph: result.commercialGraph,
  };
}

export function primaryServiceCategoryLabel(
  categories: ServiceCategory[]
): string | undefined {
  if (categories.length === 0) return undefined;
  return serviceCategoryDisplayLabel(categories[0]!);
}

export function formatSettlementRuleLabel(rule: PersistedSettlementRule): string {
  if (rule.basis?.trim()) {
    return `${rule.trigger} (${rule.basis})`;
  }
  return rule.trigger;
}
