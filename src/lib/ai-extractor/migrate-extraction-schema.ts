/**
 * Schema migration — v1–v4 extraction payloads → v5 commercial obligation graph.
 */

import type {
  ExtractedCommercialDependency,
  ExtractedCompensationTerm,
  ExtractedOperationalObligation,
  ExtractedParty,
  ExtractedSettlementEvent,
  ExtractionConfidence,
  ExtractionResult,
  CommercialDependencyType,
  CompensationTermType,
} from './extraction-types';
import { hasFixedFeeAmount, hasRevenueSharePct } from './party-obligation-metrics';
import { deliverableDescriptions } from './parse-deliverables';
import { inferServiceCategoriesForParty } from './service-category-detection';

function field<T>(
  value: T,
  confidence: ExtractionConfidence = 'high',
  rawSnippet?: string
) {
  return rawSnippet ? { value, confidence, rawSnippet } : { value, confidence };
}

function termId(partyId: string, suffix: string): string {
  return `${partyId}-${suffix}`;
}

function parseAmountFromText(text: string): number | null {
  const match = text.match(/\$?\s*([\d,]+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[1]!.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function inferDependencyType(description: string): CommercialDependencyType {
  const lower = description.toLowerCase();
  if (/attendance|exceed|threshold|500/.test(lower)) return 'attendance_threshold';
  if (/deliver|asset|completion|final/.test(lower)) return 'delivery_completion';
  if (/sponsor|funds cleared|funds clear|payment received/.test(lower)) return 'funds_cleared';
  if (/before event|after event|event day|commencement/.test(lower)) return 'event_timing';
  return 'other';
}

function formatCompensationLabel(term: ExtractedCompensationTerm, currency = 'AUD'): string {
  const amount =
    term.amount.value != null
      ? `$${term.amount.value.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`
      : null;
  const pct = term.percentage.value != null ? `${term.percentage.value}%` : null;

  switch (term.type) {
    case 'fixed_fee':
      return amount ? `Fixed fee ${amount}` : term.label.value;
    case 'revenue_share':
      return pct
        ? `${pct} revenue share${term.revenueBasis.value ? ` on ${term.revenueBasis.value}` : ''}`
        : term.label.value;
    case 'instalment':
      return amount
        ? `Instalment ${term.sequenceIndex ?? ''}: ${amount}${term.trigger.value ? ` — ${term.trigger.value}` : ''}`.trim()
        : term.label.value;
    case 'milestone':
      return amount
        ? `Milestone: ${amount}${term.trigger.value ? ` — ${term.trigger.value}` : ''}${term.deadline.value ? ` (${term.deadline.value})` : ''}`
        : term.label.value;
    case 'conditional_bonus':
      return amount
        ? `Conditional bonus ${amount}${term.trigger.value ? ` when ${term.trigger.value}` : ''}`
        : term.label.value;
    case 'attribution':
      return term.label.value || 'Customer attribution';
    default:
      return term.label.value;
  }
}

export function buildOperationalObligationsFromParty(party: ExtractedParty): ExtractedOperationalObligation[] {
  if (party.operationalObligations?.length) {
    return party.operationalObligations;
  }

  const obligations: ExtractedOperationalObligation[] = [];

  for (const [index, deliverable] of (party.deliverables ?? []).entries()) {
    const description = deliverable.description.value?.trim();
    if (!description) continue;
    obligations.push({
      id: termId(party.id, `op-${index + 1}`),
      description: deliverable.description,
      category: deliverable.category,
    });
  }

  for (const [index, milestone] of (party.milestones ?? []).entries()) {
    if (milestone.category.value !== 'performance') continue;
    const description = milestone.description.value?.trim();
    if (!description) continue;
    obligations.push({
      id: termId(party.id, `perf-${index + 1}`),
      description: milestone.description,
      category: field(null, milestone.description.confidence),
    });
  }

  const legacyDescriptions = deliverableDescriptions(party);
  for (const [index, description] of legacyDescriptions.entries()) {
    if (obligations.some((o) => o.description.value === description)) continue;
    obligations.push({
      id: termId(party.id, `legacy-${index + 1}`),
      description: field(description, 'medium'),
      category: field(null, 'absent'),
    });
  }

  return obligations;
}

function buildInstalmentTermsFromPaymentTerms(
  party: ExtractedParty,
  result: ExtractionResult
): ExtractedCompensationTerm[] {
  const partyName = party.name.value?.trim().toLowerCase() ?? '';
  const terms: ExtractedCompensationTerm[] = [];

  for (const paymentTerm of result.paymentTerms ?? []) {
    const description = paymentTerm.description.value?.trim() ?? '';
    const due = paymentTerm.dueCondition.value?.trim() ?? '';
    const amount = paymentTerm.amount.value;
    if (amount == null) continue;
    if (!description.toLowerCase().includes(partyName) && partyName.length > 0) {
      const mentionsParty =
        description.toLowerCase().includes(partyName) ||
        due.toLowerCase().includes(partyName);
      if (!mentionsParty) continue;
    }
    terms.push({
      id: termId(party.id, `inst-${terms.length + 1}`),
      type: 'instalment',
      label: field(`Instalment ${terms.length + 1}`, 'high'),
      amount: field(amount, paymentTerm.amount.confidence),
      percentage: field(null, 'absent'),
      trigger: field(due || description, paymentTerm.dueCondition.confidence),
      deadline: field(null, 'absent'),
      revenueBasis: field(null, 'absent'),
      sequenceIndex: terms.length + 1,
      confidence: paymentTerm.amount.confidence,
    });
  }

  return terms;
}

export function buildCompensationTermsFromParty(
  party: ExtractedParty,
  result: ExtractionResult
): ExtractedCompensationTerm[] {
  if (party.compensationTerms?.length) {
    return party.compensationTerms;
  }

  const terms: ExtractedCompensationTerm[] = [];
  const financialMilestones = (party.milestones ?? []).filter(
    (m) => m.category.value === 'financial'
  );
  const hasMultipleFinancialMilestones =
    financialMilestones.length >= 2 &&
    financialMilestones.every((m) => parseAmountFromText(m.description.value ?? '') != null);

  const instalmentTerms = buildInstalmentTermsFromPaymentTerms(party, result);
  if (instalmentTerms.length >= 2) {
    terms.push(...instalmentTerms);
  } else if (hasMultipleFinancialMilestones) {
    for (const [index, milestone] of financialMilestones.entries()) {
      const amount = parseAmountFromText(milestone.description.value ?? '');
      if (amount == null) continue;
      terms.push({
        id: termId(party.id, `ms-${index + 1}`),
        type: 'milestone',
        label: field(`Milestone ${index + 1}`, milestone.description.confidence),
        amount: field(amount, milestone.description.confidence),
        percentage: field(null, 'absent'),
        trigger: field(milestone.description.value, milestone.description.confidence),
        deadline: field(milestone.deadline.value, milestone.deadline.confidence),
        revenueBasis: field(null, 'absent'),
        sequenceIndex: index + 1,
        confidence: milestone.description.confidence,
      });
    }
  } else if (hasFixedFeeAmount(party)) {
    terms.push({
      id: termId(party.id, 'fixed-1'),
      type: 'fixed_fee',
      label: field('Fixed fee', party.fixedAmount.confidence),
      amount: field(party.fixedAmount.value, party.fixedAmount.confidence),
      percentage: field(null, 'absent'),
      trigger: field(null, 'absent'),
      deadline: field(null, 'absent'),
      revenueBasis: field(null, 'absent'),
      sequenceIndex: null,
      confidence: party.fixedAmount.confidence,
      rawSnippet: party.fixedAmount.rawSnippet,
    });
  }

  if (hasRevenueSharePct(party)) {
    const basis =
      party.notes.value?.trim() ||
      (party.role.value?.toLowerCase().includes('venue') ? 'bar revenue' : null);
    terms.push({
      id: termId(party.id, 'rev-1'),
      type: 'revenue_share',
      label: field('Revenue share', party.revenueSharePct.confidence),
      amount: field(null, 'absent'),
      percentage: field(party.revenueSharePct.value, party.revenueSharePct.confidence),
      trigger: field(null, 'absent'),
      deadline: field(null, 'absent'),
      revenueBasis: field(basis, party.revenueSharePct.confidence),
      sequenceIndex: null,
      confidence: party.revenueSharePct.confidence,
      rawSnippet: party.revenueSharePct.rawSnippet,
    });
  }

  if (party.participationModel.value === 'customer_attribution') {
    terms.push({
      id: termId(party.id, 'attr-1'),
      type: 'attribution',
      label: field('Customer attribution', party.participationModel.confidence),
      amount: field(null, 'absent'),
      percentage: field(party.revenueSharePct.value, party.revenueSharePct.confidence),
      trigger: field(null, 'absent'),
      deadline: field(null, 'absent'),
      revenueBasis: field(null, 'absent'),
      sequenceIndex: null,
      confidence: party.participationModel.confidence,
    });
  }

  for (const [index, conditional] of (party.conditionalPayments ?? []).entries()) {
    terms.push({
      id: termId(party.id, `bonus-${index + 1}`),
      type: 'conditional_bonus',
      label: field('Conditional bonus', conditional.trigger.confidence),
      amount: field(conditional.amount.value, conditional.amount.confidence),
      percentage: field(null, 'absent'),
      trigger: field(conditional.trigger.value, conditional.trigger.confidence),
      deadline: field(null, 'absent'),
      revenueBasis: field(null, 'absent'),
      sequenceIndex: null,
      confidence: conditional.trigger.confidence,
      rawSnippet: conditional.rawSnippet,
    });
  }

  if (
    terms.length === 0 &&
    financialMilestones.length === 1 &&
    !hasFixedFeeAmount(party)
  ) {
    const milestone = financialMilestones[0]!;
    const amount = parseAmountFromText(milestone.description.value ?? '');
    if (amount != null) {
      terms.push({
        id: termId(party.id, 'ms-1'),
        type: 'milestone',
        label: field('Milestone payment', milestone.description.confidence),
        amount: field(amount, milestone.description.confidence),
        percentage: field(null, 'absent'),
        trigger: field(milestone.description.value, milestone.description.confidence),
        deadline: field(milestone.deadline.value, milestone.deadline.confidence),
        revenueBasis: field(null, 'absent'),
        sequenceIndex: 1,
        confidence: milestone.description.confidence,
      });
    }
  }

  return terms;
}

export function buildCommercialDependenciesFromParty(
  party: ExtractedParty,
  compensationTerms: ExtractedCompensationTerm[]
): ExtractedCommercialDependency[] {
  if (party.commercialDependencies?.length) {
    return party.commercialDependencies;
  }

  const dependencies: ExtractedCommercialDependency[] = [];

  for (const [index, conditional] of compensationTerms.entries()) {
    if (conditional.type !== 'conditional_bonus') continue;
    const trigger = conditional.trigger.value?.trim();
    if (!trigger) continue;
    dependencies.push({
      id: termId(party.id, `dep-bonus-${index + 1}`),
      description: field(trigger, conditional.confidence, conditional.rawSnippet),
      type: field(inferDependencyType(trigger), conditional.confidence),
      blocksSettlement: field(true, 'high'),
      relatedCompensationId: field(conditional.id, 'high'),
      relatedDeliverableId: field(null, 'absent'),
    });
  }

  for (const [index, dep] of (party.dependencies ?? []).entries()) {
    const description = dep.dependsOn.value?.trim() || dep.obligation.value?.trim();
    if (!description) continue;
    dependencies.push({
      id: termId(party.id, `dep-${index + 1}`),
      description: field(description, 'medium'),
      type: field(inferDependencyType(description), 'medium'),
      blocksSettlement: field(true, 'medium'),
      relatedCompensationId: field(null, 'absent'),
      relatedDeliverableId: field(null, 'absent'),
    });
  }

  for (const condition of party.conditions ?? []) {
    const description = condition.dependsOn.value?.trim() || condition.description.value?.trim();
    if (!description) continue;
    if (dependencies.some((d) => d.description.value === description)) continue;
    dependencies.push({
      id: termId(party.id, `dep-cond-${dependencies.length + 1}`),
      description: field(description, 'medium'),
      type: field(inferDependencyType(description), 'medium'),
      blocksSettlement: field(true, 'medium'),
      relatedCompensationId: field(null, 'absent'),
      relatedDeliverableId: field(null, 'absent'),
    });
  }

  return dependencies;
}

export function migratePartyToV5(party: ExtractedParty, result: ExtractionResult): ExtractedParty {
  const compensationTerms = buildCompensationTermsFromParty(party, result);
  const operationalObligations = buildOperationalObligationsFromParty(party);
  const commercialDependencies = buildCommercialDependenciesFromParty(party, compensationTerms);

  return {
    ...party,
    operationalObligations,
    compensationTerms,
    commercialDependencies,
  };
}

export function detectAgreementOwner(result: ExtractionResult): ExtractionResult['agreementOwner'] {
  if (result.agreementOwner?.name.value?.trim()) {
    return result.agreementOwner;
  }

  const counterparty = result.counterparty.value?.trim();
  if (!counterparty) return undefined;

  const partyNames = new Set(
    result.parties.map((p) => p.name.value?.trim().toLowerCase()).filter(Boolean)
  );
  if (partyNames.has(counterparty.toLowerCase())) {
    return undefined;
  }

  return {
    name: field(counterparty, result.counterparty.confidence, result.counterparty.rawSnippet),
    responsibilities: [
      field('Coordinates suppliers', 'medium'),
      field('Negotiates commercial terms', 'medium'),
      field('Approves payments', 'medium'),
      field('Organises event delivery', 'medium'),
    ],
  };
}

export function migrateExtractionToV5(result: ExtractionResult): ExtractionResult {
  const inputVersion = result.schemaVersion ?? 'v4';
  const parties = result.parties.map((party) => migratePartyToV5(party, result));

  return {
    ...result,
    schemaVersion: 'v5',
    parties,
    agreementOwner: detectAgreementOwner({ ...result, parties }),
    _migratedFrom: inputVersion,
  } as ExtractionResult & { _migratedFrom?: string };
}

export function estimateFixedCommitment(terms: ExtractedCompensationTerm[]): number {
  return terms
    .filter((term) =>
      ['fixed_fee', 'instalment', 'milestone'].includes(term.type)
    )
    .reduce((sum, term) => sum + (term.amount.value ?? 0), 0);
}

export function formatCompensationTermLabel(
  term: ExtractedCompensationTerm,
  currency = 'AUD'
): string {
  return formatCompensationLabel(term, currency);
}

export function buildSettlementEventsFromCompensationTerms(
  party: ExtractedParty,
  compensationTerms: ExtractedCompensationTerm[],
  result: ExtractionResult
): ExtractedSettlementEvent[] {
  const events: ExtractedSettlementEvent[] = [];
  const settlementTriggers = collectSettlementTriggersForParty(party, result);

  for (const term of compensationTerms) {
    const eventType =
      term.type === 'revenue_share'
        ? 'revenue_share'
        : term.type === 'conditional_bonus'
          ? 'bonus'
          : term.type === 'milestone'
            ? 'milestone'
            : term.type === 'instalment'
              ? 'instalment'
              : term.type === 'attribution'
                ? 'attribution'
                : 'fixed_fee';

    events.push({
      partyId: field(party.id),
      partyName: field(party.name.value ?? ''),
      type: field(eventType),
      amount: term.amount,
      percentage: term.percentage,
      trigger: field(term.trigger.value ?? settlementTriggers[0] ?? null, term.trigger.confidence),
      condition: field(
        term.type === 'conditional_bonus' ? term.trigger.value : null,
        term.trigger.confidence
      ),
      status: term.type === 'conditional_bonus' ? 'conditional' : 'pending',
    });
  }

  return events;
}

function collectSettlementTriggersForParty(party: ExtractedParty, result: ExtractionResult): string[] {
  const triggers = new Set<string>();
  for (const rule of result.settlementRules ?? []) {
    const trigger = rule.trigger.value?.trim();
    if (trigger) triggers.add(trigger);
  }
  for (const term of result.paymentTerms ?? []) {
    const due = term.dueCondition.value?.trim();
    if (due) triggers.add(due);
  }
  for (const comp of party.compensationTerms ?? []) {
    if (comp.trigger.value?.trim()) triggers.add(comp.trigger.value.trim());
  }
  return [...triggers];
}

export function isHybridCompensation(terms: ExtractedCompensationTerm[]): boolean {
  const hasFixedLike = terms.some((t) =>
    ['fixed_fee', 'instalment', 'milestone'].includes(t.type)
  );
  const hasVariable = terms.some((t) =>
    ['revenue_share', 'conditional_bonus', 'attribution'].includes(t.type)
  );
  return hasFixedLike && hasVariable;
}
