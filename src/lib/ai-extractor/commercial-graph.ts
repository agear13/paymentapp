/**
 * V5/V6 commercial obligation graph.
 *
 * V6 additions:
 *   - Payment events use short payment labels (amount/pct only, no timing prose).
 *   - Fixed payments, revenue share, and conditional bonuses are separated.
 *   - Revenue share rows include settlement timing and conditions.
 *   - Each participant card carries explicit reviewReasons.
 *   - Grouped blockers collapse same-type issues across all participants.
 *   - Commercial risk summary replaces AI prose as the primary summary surface.
 *
 * V5 guarantees preserved:
 *   - Payment events and settlement rules are distinct.
 *   - Cross-participant trigger leakage is prevented.
 *   - Conditional bonuses attach to parent payment events.
 */

import { agreementTypeDisplayLabel } from './classify-agreement-type';
import type {
  CommercialGraphSnapshot,
  CommercialRiskItem,
  CommercialStructureMetrics,
  GroupedBlocker,
  ParticipantCommercialCard,
  ParticipantReviewStatus,
  PaymentEventModel,
  RevenueShareDetail,
  RevenueShareSummaryRow,
  ReviewReason,
  ReviewReasonCode,
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

function buildGlobalTriggerSet(result: ExtractionResult): Set<string> {
  const partyCount = result.parties.length;
  if (partyCount < 3) return new Set();

  const freq = new Map<string, number>();
  for (const party of result.parties) {
    const seen = new Set<string>();
    for (const term of party.compensationTerms ?? buildCompensationTermsFromParty(party, result)) {
      const t = term.trigger.value?.trim().toLowerCase();
      if (t) seen.add(t);
    }
    for (const t of seen) freq.set(t, (freq.get(t) ?? 0) + 1);
  }

  const threshold = partyCount - 1;
  const global = new Set<string>();
  for (const [trigger, count] of freq) {
    if (count >= threshold) global.add(trigger);
  }
  return global;
}

/* ─── Short payment labels (for payment event pays[] — amount/pct only) ─────── */

/**
 * Short label for use inside payment events.
 * Contains only the amount or percentage — no timing prose.
 */
function formatPaymentEventLabel(term: ExtractedCompensationTerm, currency: string): string {
  const amount =
    term.amount.value != null
      ? `$${term.amount.value.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`
      : null;
  const pct = term.percentage.value != null ? `${term.percentage.value}%` : null;

  switch (term.type) {
    case 'fixed_fee':
      return amount ?? 'Fixed payment';
    case 'revenue_share': {
      const basis = sanitizeRevenueBasis(term.revenueBasis.value?.trim());
      return pct
        ? `${pct}${basis ? ` ${basis}` : ' revenue share'}`
        : 'Revenue share';
    }
    case 'instalment':
      return amount ?? 'Instalment';
    case 'milestone':
      return amount ?? 'Milestone payment';
    case 'conditional_bonus':
      return amount ? `+${amount} bonus` : '+conditional bonus';
    case 'attribution':
      return 'Customer attribution';
    default:
      return amount ?? pct ?? 'Payment';
  }
}

/**
 * Sanitize revenue basis — strip any stray dollar amounts or "fixed" language
 * that the AI may have erroneously included in the revenue basis field.
 */
function sanitizeRevenueBasis(basis: string | null | undefined): string | null {
  if (!basis) return null;
  // Remove patterns like "$1,000", "fixed $xxx", "fixed split", standalone dollar amounts
  const sanitized = basis
    .replace(/\$[\d,]+(?:\.\d{1,2})?/g, '')
    .replace(/\bfixed\s+split\b/gi, '')
    .replace(/\bfixed\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return sanitized || null;
}

/* ─── Separated compensation categories ─────────────────────────────────────── */

function buildFixedPayments(terms: ExtractedCompensationTerm[], currency: string): string[] {
  return terms
    .filter((t) => t.type === 'fixed_fee' || t.type === 'instalment' || t.type === 'milestone')
    .map((t) => formatCompensationTermLabel(t, currency));
}

function buildRevenueShareTerms(terms: ExtractedCompensationTerm[], currency: string): string[] {
  return terms
    .filter((t) => t.type === 'revenue_share')
    .map((t) => {
      const pct = t.percentage.value != null ? `${t.percentage.value}%` : null;
      const basis = sanitizeRevenueBasis(t.revenueBasis.value?.trim());
      if (pct && basis) return `${pct} of ${basis}`;
      if (pct) return `${pct} revenue share`;
      return formatCompensationTermLabel(t, currency);
    });
}

function buildConditionalBonuses(terms: ExtractedCompensationTerm[], currency: string): string[] {
  return terms
    .filter((t) => t.type === 'conditional_bonus')
    .map((t) => formatCompensationTermLabel(t, currency));
}

/* ─── Payment events (V5 two-pass builder, V6 short labels) ─────────────────── */

function buildPaymentEventsForParty(
  terms: ExtractedCompensationTerm[],
  currency: string,
  globalTriggers: Set<string>
): PaymentEventModel[] {
  const eventMap = new Map<string | null, { pays: string[]; conditions: string[] }>();

  const addToEvent = (key: string | null, payLabel: string) => {
    const existing = eventMap.get(key) ?? { pays: [], conditions: [] };
    existing.pays.push(payLabel);
    eventMap.set(key, existing);
  };

  // Pass 1: build events from non-conditional terms (short labels only)
  for (const term of terms) {
    if (term.type === 'conditional_bonus') continue;

    const rawTrigger = term.trigger.value?.trim() ?? null;
    const isGlobal = rawTrigger !== null && globalTriggers.has(rawTrigger.toLowerCase());
    const effectiveTrigger = isGlobal ? null : rawTrigger;

    addToEvent(effectiveTrigger, formatPaymentEventLabel(term, currency));
  }

  // Pass 2: attach conditional bonuses to existing events (prefer timed events)
  for (const term of terms) {
    if (term.type !== 'conditional_bonus') continue;

    const conditionText = term.trigger.value?.trim() ?? 'condition met';
    const bonusLabel = formatPaymentEventLabel(term, currency);

    const allKeys = [...eventMap.keys()];
    const parentKey = allKeys.find((k) => k !== null) ?? allKeys[0] ?? null;

    const evt = eventMap.get(parentKey);
    if (evt) {
      evt.pays.push(bonusLabel);
      if (!evt.conditions.includes(conditionText)) evt.conditions.push(conditionText);
    } else {
      eventMap.set(null, { pays: [formatPaymentEventLabel(term, currency)], conditions: [conditionText] });
    }
  }

  const events: PaymentEventModel[] = [];
  for (const [due, { pays, conditions }] of eventMap) {
    if (pays.length === 0) continue;
    events.push({ due, pays, condition: conditions.length > 0 ? conditions.join('; ') : null });
  }
  return events;
}

/* ─── Settlement rules ──────────────────────────────────────────────────────── */

function buildSettlementRulesForParty(
  party: ExtractedParty,
  result: ExtractionResult,
  globalTriggers: Set<string>
): string[] {
  const rules: string[] = [];

  // Result-level settlement rules are agreement-wide clauses (not per-party in v5 schema).
  // Per-party settlement rules are not yet in ExtractedParty — handled via globalTriggers below.
  for (const rule of result.settlementRules ?? []) {
    const text = rule.trigger.value?.trim();
    if (text && !rules.some((r) => r.toLowerCase() === text.toLowerCase())) {
      rules.push(text);
    }
  }

  // Global triggers stripped from payment events — show once per party as settlement rule
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

function extractRevenueShareDetail(terms: ExtractedCompensationTerm[]): RevenueShareDetail | null {
  const term = terms.find((t) => t.type === 'revenue_share');
  if (!term || term.percentage.value == null) return null;
  const basis = sanitizeRevenueBasis(term.revenueBasis.value?.trim());
  return {
    percentage: term.percentage.value,
    revenueBasis: basis ?? 'revenue',
  };
}

/* ─── Review reasons (V6 — specific, never generic) ─────────────────────────── */

function buildReviewReasons(
  party: ExtractedParty,
  terms: ExtractedCompensationTerm[]
): ReviewReason[] {
  const reasons: ReviewReason[] = [];

  if (!party.email.value?.trim()) {
    reasons.push({ code: 'missing_email', label: 'Missing email address' });
  }

  // Payment destination is always flagged — extraction can't capture bank details
  reasons.push({ code: 'missing_payment_destination', label: 'Missing payout destination' });

  // Tax/ABN details not captured in conversation
  reasons.push({ code: 'missing_tax_details', label: 'Missing tax details' });

  const lowConfidenceTerms = terms.filter((t) => t.confidence === 'low');
  if (lowConfidenceTerms.length > 0) {
    reasons.push({
      code: 'low_confidence_compensation',
      label: `AI confidence low on ${lowConfidenceTerms.length === 1 ? 'one compensation term' : `${lowConfidenceTerms.length} compensation terms`}`,
    });
  }

  const hasConditional = terms.some((t) => t.type === 'conditional_bonus');
  if (hasConditional) {
    reasons.push({ code: 'conditional_payment_unconfirmed', label: 'Conditional payment requires confirmation' });
  }

  const hasRevShareWithoutBasis = terms.some(
    (t) => t.type === 'revenue_share' && !sanitizeRevenueBasis(t.revenueBasis.value?.trim())
  );
  if (hasRevShareWithoutBasis) {
    reasons.push({ code: 'missing_revenue_basis', label: 'Revenue share basis not specified' });
  }

  if (!party.role.value?.trim()) {
    reasons.push({ code: 'missing_role', label: 'Commercial role not defined' });
  }

  return reasons;
}

/* ─── Review status (derived from review reasons) ───────────────────────────── */

function computeReviewStatus(reasons: ReviewReason[], terms: ExtractedCompensationTerm[]): ParticipantReviewStatus {
  const hasCompensation = terms.length > 0;
  if (!hasCompensation) return 'missing_info';

  const missingInfoCodes: ReviewReasonCode[] = [
    'missing_email',
    'missing_payment_destination',
    'missing_tax_details',
    'missing_role',
  ];

  const hasMissingInfo = reasons.some((r) => missingInfoCodes.includes(r.code));
  if (hasMissingInfo) return 'missing_info';

  const reviewCodes: ReviewReasonCode[] = [
    'low_confidence_compensation',
    'conditional_payment_unconfirmed',
    'missing_revenue_basis',
    'unresolved_dependency',
  ];

  const needsReview = reasons.some((r) => reviewCodes.includes(r.code));
  if (needsReview) return 'needs_review';

  return 'ready';
}

/* ─── Low confidence items ───────────────────────────────────────────────────── */

function buildLowConfidenceItems(terms: ExtractedCompensationTerm[], currency: string): string[] {
  return terms
    .filter((t) => t.confidence === 'low' || t.confidence === 'medium')
    .map((t) => formatCompensationTermLabel(t, currency));
}

/* ─── Grouped blockers (V6) ──────────────────────────────────────────────────── */

/**
 * Collapses same-type review reasons across participants into one grouped blocker.
 * Example: 5 participants all missing email → one "Participant Emails" entry.
 */
function buildGroupedBlockers(cards: ParticipantCommercialCard[]): GroupedBlocker[] {
  const byCode = new Map<ReviewReasonCode | 'other', { reason: ReviewReason; participants: string[] }>();

  for (const card of cards) {
    for (const reason of card.reviewReasons) {
      const entry = byCode.get(reason.code) ?? { reason, participants: [] };
      if (!entry.participants.includes(card.name)) entry.participants.push(card.name);
      byCode.set(reason.code, entry);
    }
  }

  const codeToTitle: Record<ReviewReasonCode, string> = {
    missing_email: 'Participant Emails',
    missing_payment_destination: 'Payout Destinations',
    missing_tax_details: 'Tax Details',
    low_confidence_compensation: 'AI Confidence',
    conditional_payment_unconfirmed: 'Conditional Payments',
    missing_revenue_basis: 'Revenue Basis',
    missing_role: 'Commercial Roles',
    unresolved_dependency: 'Unresolved Dependencies',
  };

  const descriptionTemplate = (code: ReviewReasonCode, count: number): string => {
    const s = count === 1 ? '' : 's';
    switch (code) {
      case 'missing_email': return `${count} participant${s} require${count === 1 ? 's' : ''} an email address`;
      case 'missing_payment_destination': return `${count} participant${s} missing a payout destination`;
      case 'missing_tax_details': return `${count} participant${s} missing tax information`;
      case 'low_confidence_compensation': return `${count} participant${s} have uncertain compensation extractions`;
      case 'conditional_payment_unconfirmed': return `${count} participant${s} have unconfirmed conditional payments`;
      case 'missing_revenue_basis': return `${count} participant${s} missing revenue share basis`;
      case 'missing_role': return `${count} participant${s} missing a commercial role definition`;
      case 'unresolved_dependency': return `${count} participant${s} have unresolved commercial dependencies`;
      default: return `${count} participant${s} require attention`;
    }
  };

  return [...byCode.entries()]
    .filter(([, { participants }]) => participants.length > 0)
    .map(([code, { participants }]) => ({
      type: code,
      title: codeToTitle[code as ReviewReasonCode] ?? 'Review Required',
      description: descriptionTemplate(code as ReviewReasonCode, participants.length),
      participants,
    }))
    .sort((a, b) => b.participants.length - a.participants.length);
}

/* ─── Commercial risk summary (V6) ──────────────────────────────────────────── */

function buildCommercialRiskSummary(
  metrics: CommercialStructureMetrics,
  result: ExtractionResult
): CommercialRiskItem[] {
  const items: CommercialRiskItem[] = [];

  items.push({ type: 'fact', text: `${metrics.participantCount} commercial participant${metrics.participantCount === 1 ? '' : 's'}` });

  if (metrics.estimatedFixedCommitment > 0) {
    items.push({
      type: 'fact',
      text: `Estimated fixed commitment $${metrics.estimatedFixedCommitment.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`,
    });
  }

  if (metrics.revenueShareAgreementCount > 0) {
    items.push({ type: 'fact', text: `${metrics.revenueShareAgreementCount} revenue share agreement${metrics.revenueShareAgreementCount === 1 ? '' : 's'}` });
  }

  if (metrics.instalmentPaymentCount > 0) {
    items.push({ type: 'fact', text: `${metrics.instalmentPaymentCount} instalment payment${metrics.instalmentPaymentCount === 1 ? '' : 's'} scheduled` });
  }

  if (metrics.conditionalPaymentCount > 0) {
    items.push({ type: 'fact', text: `${metrics.conditionalPaymentCount} conditional attendance or performance bonus${metrics.conditionalPaymentCount === 1 ? '' : 'es'}` });
  }

  if (metrics.milestonePaymentCount > 0) {
    items.push({ type: 'fact', text: `${metrics.milestonePaymentCount} milestone-based payment${metrics.milestonePaymentCount === 1 ? '' : 's'}` });
  }

  const totalPaymentEvents = result.parties.reduce((sum, party) => {
    const terms = party.compensationTerms ?? buildCompensationTermsFromParty(party, result);
    const uniqueTriggers = new Set(
      terms.map((t) => t.trigger.value?.trim()).filter(Boolean)
    );
    return sum + Math.max(uniqueTriggers.size, terms.length > 0 ? 1 : 0);
  }, 0);

  if (totalPaymentEvents > 0) {
    items.push({ type: 'fact', text: `${totalPaymentEvents} scheduled payment event${totalPaymentEvents === 1 ? '' : 's'}` });
  }

  // Warnings — things requiring operator verification
  for (const party of result.parties) {
    const terms = party.compensationTerms ?? buildCompensationTermsFromParty(party, result);
    const name = party.name.value?.trim() ?? 'Unknown';
    const notes = party.notes.value?.toLowerCase() ?? '';
    // Check notes for promo / referral code mentions
    const hasPromoCode = /promo|referral\s*code|via\s+[A-Z0-9]+/i.test(party.notes.value ?? '');

    for (const term of terms) {
      if (term.type !== 'revenue_share') continue;
      const basis = sanitizeRevenueBasis(term.revenueBasis.value?.trim());
      if (!basis) {
        items.push({ type: 'warning', text: `${name}'s revenue share basis requires manual verification` });
      } else if (hasPromoCode || /promo|code|referral|via\s+[A-Z0-9]{4,}/i.test(basis)) {
        items.push({ type: 'warning', text: `${name}'s ${term.percentage.value ?? ''}% attribution relies on promo code tracking` });
      } else if (/sponsor/i.test(basis) || /sponsor/i.test(notes)) {
        items.push({ type: 'warning', text: `${name}'s sponsorship revenue requires external verification` });
      } else if (/bar|merch|merchandise|door/i.test(basis)) {
        items.push({ type: 'warning', text: `${name}'s ${basis} revenue is supplied externally` });
      }
    }
  }

  // De-duplicate warnings
  const seen = new Set<string>();
  return items.filter((item) => {
    if (item.type === 'fact') return true;
    if (seen.has(item.text)) return false;
    seen.add(item.text);
    return true;
  });
}

/* ─── Revenue share summary ──────────────────────────────────────────────────── */

function buildRevenueShareSummary(
  result: ExtractionResult,
  cards: ParticipantCommercialCard[]
): RevenueShareSummaryRow[] {
  const rows: RevenueShareSummaryRow[] = [];

  for (const card of cards) {
    if (!card.revenueShareDetail) continue;

    const party = result.parties.find((p) => p.id === card.participantId);
    const terms = party?.compensationTerms ?? [];
    const rsTerm = terms.find((t) => t.type === 'revenue_share');

    // Settlement timing: from revenue share term's trigger
    const settlement = rsTerm?.trigger.value?.trim() ?? undefined;
    // Condition: from commercial dependencies related to revenue share
    const dep = party?.commercialDependencies?.find(
      (d) => /sponsor|fund|clear|revenue/i.test(d.description.value ?? '')
    );
    const condition = dep?.description.value?.trim() ?? undefined;

    // Referral code from notes
    let referralCode: string | undefined;
    if (party?.notes.value) {
      const match = party.notes.value.match(/promo(?:tion)?\s*(?:code)?[:\s]+([A-Z0-9]+)/i);
      if (match?.[1]) referralCode = match[1];
    }

    rows.push({
      participantId: card.participantId,
      participantName: card.name,
      percentage: card.revenueShareDetail.percentage,
      revenueBasis: card.revenueShareDetail.revenueBasis,
      referralCode,
      settlement,
      condition,
    });
  }

  return rows;
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
    bullets.push(`${metrics.hybridCompensationCount} hybrid compensation arrangement${metrics.hybridCompensationCount === 1 ? '' : 's'}`);
  }
  if (metrics.milestonePaymentCount > 0) {
    bullets.push(`${metrics.milestonePaymentCount} milestone payment arrangement${metrics.milestonePaymentCount === 1 ? '' : 's'}`);
  }
  if (metrics.instalmentPaymentCount > 0) {
    bullets.push(`${metrics.instalmentPaymentCount} instalment payment${metrics.instalmentPaymentCount === 1 ? '' : 's'}`);
  }
  if (metrics.revenueShareAgreementCount > 0) {
    bullets.push(`${metrics.revenueShareAgreementCount} revenue share agreement${metrics.revenueShareAgreementCount === 1 ? '' : 's'}`);
  }
  if (metrics.conditionalPaymentCount > 0) {
    bullets.push(`${metrics.conditionalPaymentCount} conditional bonus${metrics.conditionalPaymentCount === 1 ? '' : 'es'}`);
  }
  if (metrics.estimatedFixedCommitment > 0) {
    bullets.push(`Estimated committed fixed spend: $${metrics.estimatedFixedCommitment.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`);
  }
  if (metrics.variableRevenueBases.length > 0) {
    bullets.push(`Additional variable obligations tied to ${metrics.variableRevenueBases.join(', ')}`);
  }
  return { bulletPoints: bullets };
}

export function buildCommercialSummaryNarrative(
  result: ExtractionResult,
  metrics: CommercialStructureMetrics
): string {
  const agreementName = result.projectName.value?.trim() || 'This agreement';
  const parts: string[] = [];

  parts.push(`${agreementName} engages ${metrics.participantCount} independent supplier${metrics.participantCount === 1 ? '' : 's'}.`);

  if (metrics.hybridCompensationCount > 0) {
    parts.push(`${metrics.hybridCompensationCount} supplier${metrics.hybridCompensationCount === 1 ? ' receives a hybrid compensation arrangement combining fixed payments and revenue sharing' : 's receive hybrid compensation combining fixed payments and revenue sharing'}.`);
  }
  if (metrics.milestonePaymentCount > 0) {
    parts.push('At least one supplier has milestone-based payments tied to delivery.');
  }
  if (metrics.instalmentPaymentCount > 0) {
    parts.push('At least one supplier has instalment payments tied to event timing.');
  }
  if (metrics.conditionalPaymentCount > 0) {
    parts.push(`${metrics.conditionalPaymentCount} supplier${metrics.conditionalPaymentCount === 1 ? ' has a conditional attendance or performance bonus' : 's have conditional attendance or performance bonuses'}.`);
  }
  if (metrics.estimatedFixedCommitment > 0) {
    parts.push(`The agreement commits approximately $${metrics.estimatedFixedCommitment.toLocaleString('en-AU', { maximumFractionDigits: 0 })} in fixed payments`);
    if (metrics.variableRevenueBases.length > 0) {
      parts.push(`in addition to revenue share obligations across ${metrics.variableRevenueBases.join(', ')}.`);
    } else {
      parts.push('in addition to any variable revenue share obligations.');
    }
  } else if (metrics.variableRevenueBases.length > 0) {
    parts.push(`Compensation is primarily variable, tied to ${metrics.variableRevenueBases.join(', ')}.`);
  }

  return parts.join(' ');
}

/* ─── Legacy settlement triggers ────────────────────────────────────────────── */

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

/* ─── Main graph builder ─────────────────────────────────────────────────────── */

export function buildCommercialGraph(result: ExtractionResult): CommercialGraphSnapshot {
  const metrics = buildCommercialStructureMetrics(result);
  const owner = detectAgreementOwner(result);
  const currency = result.currency.value?.trim().toUpperCase() || 'AUD';
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
    const reviewReasons = buildReviewReasons(party, compensation);
    const reviewStatus = computeReviewStatus(reviewReasons, compensation);

    return {
      participantId: party.id,
      name: party.name.value?.trim() || 'Unnamed participant',
      role: party.role.value?.trim() || 'Participant',
      serviceCategory: categories.length > 0 ? serviceCategoryDisplayLabel(categories[0]!) : null,
      deliverables: operational.map((o) => o.description.value?.trim()).filter(Boolean) as string[],
      operationalObligations: operational.map((o) => o.description.value?.trim()).filter(Boolean) as string[],
      compensationTerms: compensation.map((t) => formatCompensationTermLabel(t, currency)),
      fixedPayments: buildFixedPayments(compensation, currency),
      revenueShareTerms: buildRevenueShareTerms(compensation, currency),
      conditionalBonuses: buildConditionalBonuses(compensation, currency),
      paymentEvents,
      settlementRules,
      settlementSchedule: settlementTriggersForParty(result, party.id),
      dependencies: dependencies.map((d) => d.description.value?.trim()).filter(Boolean) as string[],
      revenueShareDetail,
      lowConfidenceItems,
      reviewReasons,
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
  const groupedBlockers = buildGroupedBlockers(participantCards);
  const commercialRiskSummary = buildCommercialRiskSummary(metrics, result);

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
    groupedBlockers,
    commercialRiskSummary,
    readinessAssessment: result.readinessAssessment,
  };
}

export function enrichExtractionWithCommercialGraph(result: ExtractionResult): ExtractionResult {
  return {
    ...result,
    commercialGraph: buildCommercialGraph(result),
  };
}
