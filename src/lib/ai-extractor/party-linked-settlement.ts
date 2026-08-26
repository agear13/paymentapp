import type {
  ExtractedParty,
  ExtractedPaymentTerm,
  ExtractedSettlementRule,
  ExtractionResult,
} from './extraction-types';

/** Shown in review when a party has an entitlement but no party-linked timing. */
export const PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT =
  'Payment timing not specified in agreement';

function partyNameKey(party: ExtractedParty): string {
  return party.name.value?.trim().toLowerCase() ?? '';
}

function textMentionsPartyName(text: string | null | undefined, partyName: string): boolean {
  if (!partyName || partyName.length < 2) return false;
  const haystack = text?.trim().toLowerCase() ?? '';
  return haystack.length > 0 && haystack.includes(partyName);
}

/** True when a project payment term explicitly names this participant. */
export function paymentTermIsLinkedToParty(
  term: ExtractedPaymentTerm,
  party: ExtractedParty
): boolean {
  const partyName = partyNameKey(party);
  return (
    textMentionsPartyName(term.description.value, partyName) ||
    textMentionsPartyName(term.dueCondition.value, partyName)
  );
}

/** True when an agreement-wide settlement rule explicitly names this participant. */
export function settlementRuleIsLinkedToParty(
  rule: ExtractedSettlementRule,
  party: ExtractedParty
): boolean {
  const partyName = partyNameKey(party);
  return (
    textMentionsPartyName(rule.trigger.value, partyName) ||
    textMentionsPartyName(rule.basis.value, partyName)
  );
}

/**
 * Settlement triggers that belong to this party — never unlinked project
 * paymentTerms or agreement-wide settlementRules.
 */
export function collectPartyOwnedSettlementTriggers(
  party: ExtractedParty,
  result: ExtractionResult
): string[] {
  const triggers = new Set<string>();

  for (const term of party.compensationTerms ?? []) {
    const trigger = term.trigger.value?.trim();
    if (trigger) triggers.add(trigger);
    const deadline = term.deadline.value?.trim();
    if (deadline) triggers.add(deadline);
  }

  for (const milestone of party.milestones ?? []) {
    if (milestone.category.value !== 'financial') continue;
    const deadline = milestone.deadline.value?.trim();
    if (deadline) triggers.add(deadline);
  }

  for (const term of result.paymentTerms ?? []) {
    if (!paymentTermIsLinkedToParty(term, party)) continue;
    const due = term.dueCondition.value?.trim();
    if (due) triggers.add(due);
  }

  for (const rule of result.settlementRules ?? []) {
    if (!settlementRuleIsLinkedToParty(rule, party)) continue;
    const trigger = rule.trigger.value?.trim();
    if (trigger) triggers.add(trigger);
  }

  return [...triggers];
}
