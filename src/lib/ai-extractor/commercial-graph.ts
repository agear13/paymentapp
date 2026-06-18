/**
 * V5 commercial obligation graph — structured metrics, summary, and participant cards.
 *
 * Key guarantees:
 *   - Payment events and settlement rules are distinct concepts.
 *   - Per-participant data never inherits clauses from other participants (leakage guard).
 *   - Conditional bonuses attach to their parent payment event.
 *   - Revenue share summary is structured, not a generic count.
 *   - Every participant card has a computed review status.
 */

import { agreementTypeDisplayLabel } from './classify-agreement-type';
import type {
  CommercialGraphSnapshot,
  CommercialStructureMetrics,
  ParticipantCommercialCard,
  ParticipantReviewStatus,
  PaymentEventModel,
  RevenueShareDetail,
  RevenueShareSummaryRow,
} from './commercial-graph-types';
import type { ExtractedCompensationTerm, ExtractedParty, ExtractionResult } from './extraction-types';
import {
  buildCommercialDependenciesFromParty,
  buildCompensationTermsFromParty,
  buildOperationalObligationsFromParty,
  detectAgreementOwner,
  estimateFixedCommitment,
  formatCompensationTermLabel,
  isHybridCompensation,
} from './migrate-extraction-schema';
import { inferServiceCategoriesForParty } from './service-category-detection';
import { serviceCategoryDisplayLabel } from './service-category';

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function collectVariableRevenueBases(result: ExtractionResult): string[] {
  const basis = new Set<string>();
  for (const party of result.parties) {
    for (const term of party.compensationTerms ?? buildCompensationTermsFromParty(party, result)) {
      if (term.type !== 'revenue_share') continue;
      const label = term.revenueBasis.value?.trim();
      if (label) basis.add(label);
    }
  }
  return [...basis];
}

/* ─── Cross-participant leakage guard ──────────────────────────────────────── */

/**
 * Returns the set of trigger strings that appear in ALL (or all but one) parties'
 * compensation terms. These are global settlement clauses that the AI has
 * erroneously applied to every party — they should not appear as per-party
 * payment events.
 *
 * Threshold: if a trigger appears in ≥ (N - 1) parties for N ≥ 3 parties, treat
 * it as a global clause.
 */
function buildGlobalTriggerSet(result: ExtractionResult): Set<string> {
  const partyCount = result.parties.length;
  if (partyCount < 3) return new Set();

  const triggerFrequency = new Map<string, number>();

  for (const party of result.parties) {
    const partyTriggers = new Set<string>();
    for (const term of party.compensationTerms ?? buildCompensationTermsFromParty(party, result)) {
      const t = term.trigger.value?.trim().toLowerCase();
      if (t) partyTriggers.add(t);
    }
    for (const t of partyTriggers) {
      triggerFrequency.set(t, (triggerFrequency.get(t) ?? 0) + 1);
    }
  }

  const threshold = partyCount - 1;
  const global = new Set<string>();
  for (const [trigger, freq] of triggerFrequency) {
    if (freq >= threshold) global.add(trigger);
  }
  return global;
}

/* ─── Payment event builder ─────────────────────────────────────────────────── */

/**
 * Groups a party's compensation terms into payment events.
 *
 * Rules:
 *   1. Terms are grouped by their timing trigger (Pass 1).
 *   2. `conditional_bonus` terms (Pass 2) attach to an existing event as a
 *      conditional add-on rather than becoming standalone events. They prefer
 *      to join the first event with a non-null timing; if none exists, they
 *      join the null-key group.
 *   3. Triggers that appear in globalTriggers (cross-participant leakage) are
 *      excluded from payment events and surfaced in settlementRules instead.
 *   4. Terms with null triggers form a single "timing not captured" event.
 */
function buildPaymentEventsForParty(
  terms: ExtractedCompensationTerm[],
  currency: string,
  globalTriggers: Set<string>
): PaymentEventModel[] {
  const eventMap = new Map<string | null, {
    pays: string[];
    conditions: string[];
  }>();

  const addToEvent = (key: string | null, payLabel: string) => {
    const existing = eventMap.get(key) ?? { pays: [], conditions: [] };
    existing.pays.push(payLabel);
    eventMap.set(key, existing);
  };

  // Pass 1: build events from non-conditional terms
  for (const term of terms) {
    if (term.type === 'conditional_bonus') continue;

    const rawTrigger = term.trigger.value?.trim() ?? null;
    const isGlobal = rawTrigger !== null && globalTriggers.has(rawTrigger.toLowerCase());
    const effectiveTrigger = isGlobal ? null : rawTrigger;

    addToEvent(effectiveTrigger, formatCompensationTermLabel(term, currency));
  }

  // Pass 2: attach conditional bonuses to existing events
  // Each conditional bonus joins the first event with a real timing (non-null),
  // or falls back to the null-key group, rather than becoming a standalone event.
  for (const term of terms) {
    if (term.type !== 'conditional_bonus') continue;

    const conditionText = term.trigger.value?.trim() ?? 'condition met';
    const bonusLabel =
      term.amount.value != null
        ? `+$${term.amount.value.toLocaleString('en-AU', { maximumFractionDigits: 0 })} bonus`
        : '+conditional bonus';

    // Prefer first event that has a real timing; otherwise use null (or first available)
    const allKeys = [...eventMap.keys()];
    const parentKey =
      allKeys.find((k) => k !== null) ??
      allKeys[0] ??
      null;

    const evt = eventMap.get(parentKey);
    if (evt) {
      evt.pays.push(bonusLabel);
      if (!evt.conditions.includes(conditionText)) evt.conditions.push(conditionText);
    } else {
      // No existing event — create a standalone conditional event
      eventMap.set(null, {
        pays: [formatCompensationTermLabel(term, currency)],
        conditions: [conditionText],
      });
    }
  }

  const events: PaymentEventModel[] = [];
  for (const [due, { pays, conditions }] of eventMap) {
    if (pays.length === 0) continue;
    events.push({
      due,
      pays,
      condition: conditions.length > 0 ? conditions.join('; ') : null,
    });
  }

  return events;
}

/* ─── Settlement rules ──────────────────────────────────────────────────────── */

/**
 * Returns settlement rules for a party, drawn only from their own
 * `settlementRules` field (party-specific clauses). Never inherits from
 * other parties. Triggers in globalTriggers are surfaced here rather than
 * in payment events.
 */
function buildSettlementRulesForParty(
  party: ExtractedParty,
  result: ExtractionResult,
  globalTriggers: Set<string>
): string[] {
  const rules: string[] = [];

  // Party-level settlement rules (from v5 extraction)
  for (const rule of party.settlementRules ?? []) {
    const text = rule.trigger.value?.trim();
    if (text) rules.push(text);
  }

  // Global triggers that were stripped from payment events — show here once
  for (const term of party.compensationTerms ?? buildCompensationTermsFromParty(party, result)) {
    const rawTrigger = term.trigger.value?.trim();
    if (!rawTrigger) continue;
    const key = rawTrigger.toLowerCase();
    if (globalTriggers.has(key) && !rules.some((r) => r.toLowerCase() === key)) {
      rules.push(rawTrigger);
    }
  }

  return uniqueNonEmpty(rules);
}

/* ─── Revenue share detail ───────────────────────────────────────────────────── */

function extractRevenueShareDetail(
  terms: ExtractedCompensationTerm[]
): RevenueShareDetail | null {
  const term = terms.find((t) => t.type === 'revenue_share');
  if (!term || term.percentage.value == null) return null;
  return {
    percentage: term.percentage.value,
    revenueBasis: term.revenueBasis.value?.trim() || 'revenue',
  };
}

/* ─── Low confidence items ───────────────────────────────────────────────────── */

function buildLowConfidenceItems(
  terms: ExtractedCompensationTerm[],
  currency: string
): string[] {
  return terms
    .filter((t) => t.confidence === 'low' || t.confidence === 'medium')
    .map((t) => formatCompensationTermLabel(t, currency));
}

/* ─── Review status ──────────────────────────────────────────────────────────── */

function computeReviewStatus(
  party: ExtractedParty,
  terms: ExtractedCompensationTerm[],
  operational: ReturnType<typeof buildOperationalObligationsFromParty>
): ParticipantReviewStatus {
  const hasEmail = Boolean(party.email.value?.trim());
  const hasCompensation = terms.length > 0;
  const hasRole = Boolean(party.role.value?.trim());

  if (!hasCompensation || !hasRole) return 'missing_info';

  const hasLowConfidence = terms.some((t) => t.confidence === 'low');
  const hasAmbiguousAmount = terms.some((t) => t.amount.value == null && t.percentage.value == null && t.type !== 'attribution');
  if (hasLowConfidence || hasAmbiguousAmount || !hasEmail) return 'needs_review';

  return 'ready';
}

/* ─── Commercial structure metrics ──────────────────────────────────────────── */

export function buildCommercialStructureMetrics(result: ExtractionResult): CommercialStructureMetrics {
  let deliverableCount = 0;
  let operationalObligationCount = 0;
  let compensationTermCount = 0;
  let revenueShareAgreementCount = 0;
  let fixedPaymentAgreementCount = 0;
  let hybridCompensationCount = 0;
  let milestonePaymentCount = 0;
  let instalmentPaymentCount = 0;
  let conditionalPaymentCount = 0;
  let estimatedFixedCommitment = 0;

  for (const party of result.parties) {
    const operational = party.operationalObligations ?? buildOperationalObligationsFromParty(party);
    const compensation = party.compensationTerms ?? buildCompensationTermsFromParty(party, result);

    deliverableCount += operational.length;
    operationalObligationCount += operational.length;
    compensationTermCount += compensation.length;
    estimatedFixedCommitment += estimateFixedCommitment(compensation);

    if (compensation.some((t) => t.type === 'revenue_share')) revenueShareAgreementCount += 1;
    if (compensation.some((t) => t.type === 'fixed_fee')) fixedPaymentAgreementCount += 1;
    milestonePaymentCount += compensation.filter((t) => t.type === 'milestone').length;
    instalmentPaymentCount += compensation.filter((t) => t.type === 'instalment').length;
    if (compensation.some((t) => t.type === 'conditional_bonus')) conditionalPaymentCount += 1;
    if (isHybridCompensation(compensation)) hybridCompensationCount += 1;
  }

  const agreementType = result.agreementType?.value ?? null;
  const owner = detectAgreementOwner(result);

  return {
    agreementType,
    agreementTypeLabel: agreementType
      ? agreementTypeDisplayLabel(agreementType)
      : 'Commercial Agreement',
    agreementOwner: owner?.name.value?.trim() ?? null,
    participantCount: result.parties.length,
    deliverableCount,
    operationalObligationCount,
    compensationTermCount,
    settlementEventCount: result.settlementEvents?.length ?? 0,
    revenueShareAgreementCount,
    fixedPaymentAgreementCount,
    hybridCompensationCount,
    milestonePaymentCount,
    instalmentPaymentCount,
    conditionalPaymentCount,
    estimatedFixedCommitment,
    variableRevenueBases: collectVariableRevenueBases(result),
    settlementBlockers: result.readinessAssessment?.settlementBlockers ?? [],
  };
}

export function buildCommercialStructureOverview(
  metrics: CommercialStructureMetrics
): { bulletPoints: string[] } {
  const bullets: string[] = [
    `${metrics.participantCount} commercial participant${metrics.participantCount === 1 ? '' : 's'}`,
  ];

  if (metrics.hybridCompensationCount > 0) {
    bullets.push(
      `${metrics.hybridCompensationCount} hybrid compensation arrangement${metrics.hybridCompensationCount === 1 ? '' : 's'}`
    );
  }
  if (metrics.milestonePaymentCount > 0) {
    bullets.push(
      `${metrics.milestonePaymentCount} milestone payment arrangement${metrics.milestonePaymentCount === 1 ? '' : 's'}`
    );
  }
  if (metrics.instalmentPaymentCount > 0) {
    bullets.push(
      `${metrics.instalmentPaymentCount} instalment payment${metrics.instalmentPaymentCount === 1 ? '' : 's'}`
    );
  }
  if (metrics.revenueShareAgreementCount > 0) {
    bullets.push(
      `${metrics.revenueShareAgreementCount} revenue share agreement${metrics.revenueShareAgreementCount === 1 ? '' : 's'}`
    );
  }
  if (metrics.conditionalPaymentCount > 0) {
    bullets.push(
      `${metrics.conditionalPaymentCount} conditional bonus${metrics.conditionalPaymentCount === 1 ? '' : 'es'}`
    );
  }

  if (metrics.estimatedFixedCommitment > 0) {
    bullets.push(
      `Estimated committed fixed spend: $${metrics.estimatedFixedCommitment.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`
    );
  }

  if (metrics.variableRevenueBases.length > 0) {
    bullets.push(
      `Additional variable obligations tied to ${metrics.variableRevenueBases.join(', ')}`
    );
  }

  return { bulletPoints: bullets };
}

export function buildCommercialSummaryNarrative(
  result: ExtractionResult,
  metrics: CommercialStructureMetrics
): string {
  const agreementName = result.projectName.value?.trim() || 'This agreement';
  const parts: string[] = [];

  parts.push(
    `${agreementName} engages ${metrics.participantCount} independent supplier${metrics.participantCount === 1 ? '' : 's'}.`
  );

  if (metrics.hybridCompensationCount > 0) {
    parts.push(
      `${metrics.hybridCompensationCount} supplier${metrics.hybridCompensationCount === 1 ? ' receives a hybrid compensation arrangement combining fixed payments and revenue sharing' : 's receive hybrid compensation combining fixed payments and revenue sharing'}.`
    );
  }

  if (metrics.milestonePaymentCount > 0) {
    parts.push('At least one supplier has milestone-based payments tied to delivery.');
  }

  if (metrics.instalmentPaymentCount > 0) {
    parts.push('At least one supplier has instalment payments tied to event timing.');
  }

  if (metrics.conditionalPaymentCount > 0) {
    parts.push(
      `${metrics.conditionalPaymentCount} supplier${metrics.conditionalPaymentCount === 1 ? ' has a conditional attendance or performance bonus' : 's have conditional attendance or performance bonuses'}.`
    );
  }

  if (metrics.estimatedFixedCommitment > 0) {
    parts.push(
      `The agreement commits approximately $${metrics.estimatedFixedCommitment.toLocaleString('en-AU', { maximumFractionDigits: 0 })} in fixed payments`
    );
    if (metrics.variableRevenueBases.length > 0) {
      parts.push(
        `in addition to revenue share obligations across ${metrics.variableRevenueBases.join(', ')}.`
      );
    } else {
      parts.push('in addition to any variable revenue share obligations.');
    }
  } else if (metrics.variableRevenueBases.length > 0) {
    parts.push(
      `Compensation is primarily variable, tied to ${metrics.variableRevenueBases.join(', ')}.`
    );
  }

  return parts.join(' ');
}

/* ─── Settlement triggers (legacy compat) ─────────────────────────────────── */

function settlementTriggersForParty(result: ExtractionResult, partyId: string): string[] {
  const fromEvents = (result.settlementEvents ?? [])
    .filter((event) => event.partyId.value === partyId)
    .map((event) => event.trigger.value?.trim())
    .filter(Boolean) as string[];

  const party = result.parties.find((p) => p.id === partyId);
  const fromTerms = (party?.compensationTerms ?? [])
    .map((term) => term.trigger.value?.trim())
    .filter(Boolean) as string[];

  return uniqueNonEmpty([...fromEvents, ...fromTerms]);
}

/* ─── Revenue share summary ──────────────────────────────────────────────────── */

function buildRevenueShareSummary(
  result: ExtractionResult,
  cards: ParticipantCommercialCard[]
): RevenueShareSummaryRow[] {
  const rows: RevenueShareSummaryRow[] = [];

  for (const card of cards) {
    if (!card.revenueShareDetail) continue;
    rows.push({
      participantId: card.participantId,
      participantName: card.name,
      percentage: card.revenueShareDetail.percentage,
      revenueBasis: card.revenueShareDetail.revenueBasis,
      referralCode: card.revenueShareDetail.referralCode,
    });
  }

  // Also pull referral codes from parties if present (not yet in card)
  for (const row of rows) {
    const party = result.parties.find((p) => p.id === row.participantId);
    if (party?.notes.value) {
      const codeMatch = party.notes.value.match(/promo(?:tion)? code[:\s]+([A-Z0-9]+)/i);
      if (codeMatch?.[1]) row.referralCode = codeMatch[1];
    }
  }

  return rows;
}

/* ─── Main graph builder ─────────────────────────────────────────────────────── */

export function buildCommercialGraph(result: ExtractionResult): CommercialGraphSnapshot {
  const metrics = buildCommercialStructureMetrics(result);
  const owner = detectAgreementOwner(result);
  const currency = result.currency.value?.trim().toUpperCase() || 'AUD';

  // Compute global trigger set once for all parties (leakage guard)
  const globalTriggers = buildGlobalTriggerSet(result);

  const participantCards: ParticipantCommercialCard[] = result.parties.map((party) => {
    const categories = inferServiceCategoriesForParty(party);
    const operational = party.operationalObligations ?? buildOperationalObligationsFromParty(party);
    const compensation = party.compensationTerms ?? buildCompensationTermsFromParty(party, result);
    const dependencies = party.commercialDependencies ?? buildCommercialDependenciesFromParty(party, compensation);

    const paymentEvents = buildPaymentEventsForParty(compensation, currency, globalTriggers);
    const settlementRules = buildSettlementRulesForParty(party, result, globalTriggers);
    const revenueShareDetail = extractRevenueShareDetail(compensation);
    const lowConfidenceItems = buildLowConfidenceItems(compensation, currency);
    const reviewStatus = computeReviewStatus(party, compensation, operational);

    return {
      participantId: party.id,
      name: party.name.value?.trim() || 'Unnamed participant',
      role: party.role.value?.trim() || 'Participant',
      serviceCategory:
        categories.length > 0 ? serviceCategoryDisplayLabel(categories[0]!) : null,
      deliverables: operational.map((o) => o.description.value?.trim()).filter(Boolean) as string[],
      operationalObligations: operational
        .map((o) => o.description.value?.trim())
        .filter(Boolean) as string[],
      compensationTerms: compensation.map((t) => formatCompensationTermLabel(t, currency)),
      paymentEvents,
      settlementRules,
      // Legacy field — kept for backward compatibility
      settlementSchedule: settlementTriggersForParty(result, party.id),
      dependencies: dependencies.map((d) => d.description.value?.trim()).filter(Boolean) as string[],
      revenueShareDetail,
      lowConfidenceItems,
      reviewStatus,
    };
  });

  const settlementSchedule = participantCards.map((card) => ({
    participantId: card.participantId,
    participantName: card.name,
    compensationSummary: card.compensationTerms,
    settlementTriggers:
      card.settlementSchedule.length > 0
        ? card.settlementSchedule
        : ['Settlement timing not explicitly captured'],
  }));

  const revenueShareSummary = buildRevenueShareSummary(result, participantCards);

  return {
    schemaVersion: 'v5',
    agreementOwner: owner?.name.value?.trim() ?? null,
    agreementOwnerResponsibilities: (owner?.responsibilities ?? [])
      .map((r) => r.value?.trim())
      .filter(Boolean) as string[],
    commercialStructure: metrics,
    commercialSummary: buildCommercialSummaryNarrative(result, metrics),
    commercialStructureOverview: buildCommercialStructureOverview(metrics),
    participantCards,
    settlementSchedule,
    operationalObligations: participantCards.map((card) => ({
      participant: card.name,
      items: card.operationalObligations,
    })),
    compensationTerms: participantCards.map((card) => ({
      participant: card.name,
      items: card.compensationTerms,
    })),
    revenueShareSummary,
    readinessAssessment: result.readinessAssessment,
  };
}

export function enrichExtractionWithCommercialGraph(result: ExtractionResult): ExtractionResult {
  return {
    ...result,
    commercialGraph: buildCommercialGraph(result),
  };
}
