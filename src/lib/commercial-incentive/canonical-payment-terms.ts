import type {
  ExtractedCompensationTerm,
  ExtractionResult,
} from '@/lib/ai-extractor/extraction-types';
import { parseDelayedPaymentDays } from '@/lib/commercial-incentive/detect-delayed-terms';

/**
 * Canonical delayed-payment slices from the existing extraction graph.
 * Does not invent terms and does not scan free-text notes/prose.
 */
export type CanonicalPaymentTermSlice = {
  description: string | null;
  dueText: string | null;
  amount: number | null;
  currency: string | null;
  source: 'paymentTerm' | 'compensationTerm' | 'settlementEvent';
};

const COMPENSATION_PAYMENT_TYPES = new Set(['instalment', 'milestone', 'fixed_fee']);
const EVENT_PAYMENT_TYPES = new Set(['instalment', 'milestone', 'fixed_fee']);

function trimText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function finiteAmount(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

function fromCompensationTerm(
  term: ExtractedCompensationTerm,
  fallbackCurrency: string | null
): CanonicalPaymentTermSlice | null {
  if (!COMPENSATION_PAYMENT_TYPES.has(term.type)) return null;
  return {
    description: trimText(term.label.value),
    dueText:
      trimText(term.trigger.value) ||
      trimText(term.deadline.value) ||
      null,
    amount: finiteAmount(term.amount.value),
    currency: fallbackCurrency,
    source: 'compensationTerm',
  };
}

function agreementSettlementTiming(result: ExtractionResult): string | null {
  for (const rule of result.settlementRules ?? []) {
    const trigger = trimText(rule.trigger.value);
    if (trigger && parseDelayedPaymentDays(trigger) != null) return trigger;
    const basis = trimText(rule.basis.value);
    if (basis && parseDelayedPaymentDays(basis) != null) return basis;
  }
  return null;
}

function overlayMissingTiming(
  slices: CanonicalPaymentTermSlice[],
  timing: string | null
): CanonicalPaymentTermSlice[] {
  if (!timing) return slices;
  return slices.map((slice) => {
    if (slice.dueText && parseDelayedPaymentDays(slice.dueText) != null) return slice;
    if (slice.amount == null && !slice.dueText) return slice;
    return { ...slice, dueText: slice.dueText || timing };
  });
}

/**
 * Prefer the structured representation Agreement Intelligence actually displays:
 * compensationTerms[].trigger for milestone/instalment payments, then paymentTerms,
 * then settlementEvents. Settlement-rule timing is applied only when a slice lacks
 * its own parseable due text.
 */
export function collectCanonicalPaymentTerms(
  result: ExtractionResult
): CanonicalPaymentTermSlice[] {
  const currency = trimText(result.currency.value);
  const compensationSlices: CanonicalPaymentTermSlice[] = [];
  for (const party of result.parties ?? []) {
    for (const term of party.compensationTerms ?? []) {
      const slice = fromCompensationTerm(term, currency);
      if (slice) compensationSlices.push(slice);
    }
  }

  const paymentTermSlices: CanonicalPaymentTermSlice[] = (result.paymentTerms ?? []).map(
    (term) => ({
      description: trimText(term.description?.value),
      dueText: trimText(term.dueCondition?.value),
      amount: finiteAmount(term.amount?.value),
      currency: trimText(term.currency?.value) || currency,
      source: 'paymentTerm' as const,
    })
  );

  const eventSlices: CanonicalPaymentTermSlice[] = [];
  for (const event of result.settlementEvents ?? []) {
    if (!EVENT_PAYMENT_TYPES.has(event.type.value ?? '')) continue;
    eventSlices.push({
      description: trimText(event.partyName.value),
      dueText: trimText(event.trigger.value) || trimText(event.condition.value),
      amount: finiteAmount(event.amount.value),
      currency,
      source: 'settlementEvent',
    });
  }

  const preferred =
    compensationSlices.length > 0
      ? compensationSlices
      : paymentTermSlices.length > 0
        ? paymentTermSlices
        : eventSlices;

  return overlayMissingTiming(preferred, agreementSettlementTiming(result));
}

export function originalDueLabelsFromExtraction(result: ExtractionResult | null): string[] {
  if (!result) return [];
  const labels: string[] = [];
  for (const slice of collectCanonicalPaymentTerms(result)) {
    const label = slice.dueText || slice.description;
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels;
}
