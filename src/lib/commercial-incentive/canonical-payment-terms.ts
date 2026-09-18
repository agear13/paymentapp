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

function unwrapFieldValue(raw: unknown): unknown {
  if (raw == null) return null;
  if (typeof raw === 'number' || typeof raw === 'string') return raw;
  if (typeof raw === 'object' && 'value' in raw) {
    const inner = (raw as { value: unknown }).value;
    if (inner && typeof inner === 'object' && 'value' in (inner as object)) {
      return unwrapFieldValue(inner);
    }
    return inner;
  }
  return null;
}

/** Parse an explicit money amount. Does not treat "Milestone 1" as A$1. */
export function parseMoneyFromText(text: string | null | undefined): number | null {
  const value = text?.trim();
  if (!value) return null;
  const match = value.match(/(?:A\$|AU\$|\$|AUD\s+)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!match) return null;
  const parsed = Number.parseFloat(match[1]!.replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function asMoneyAmount(raw: unknown): number | null {
  const unwrapped = unwrapFieldValue(raw);
  if (typeof unwrapped === 'number' && Number.isFinite(unwrapped)) return unwrapped;
  if (typeof unwrapped === 'string') {
    const labelled = parseMoneyFromText(unwrapped);
    if (labelled != null) return labelled;
    const plain = Number.parseFloat(unwrapped.replace(/,/g, ''));
    if (Number.isFinite(plain) && plain > 0) return plain;
  }
  return null;
}

function isSequenceOrUnitAmount(amount: number, siblingCount: number): boolean {
  if (!Number.isInteger(amount) || amount <= 0) return false;
  if (amount === 1) return true;
  return siblingCount >= 2 && amount <= siblingCount;
}

function equalShareOfProject(
  projectValue: number | null | undefined,
  siblingCount: number
): number | null {
  if (
    projectValue == null ||
    !Number.isFinite(projectValue) ||
    projectValue <= 0 ||
    siblingCount < 2
  ) {
    return null;
  }
  const share = projectValue / siblingCount;
  if (!Number.isFinite(share) || share <= 0) return null;
  const rounded = Math.round(share * 100) / 100;
  const reconstructed = Math.round(rounded * siblingCount * 100) / 100;
  return Math.abs(reconstructed - projectValue) < 0.01 ? rounded : null;
}

function looksLikeEqualPercentages(amounts: number[], siblingCount: number): boolean {
  if (amounts.length !== siblingCount || siblingCount < 2) return false;
  const sum = amounts.reduce((total, amount) => total + amount, 0);
  return (
    amounts.every((amount) => amount > 0 && amount <= 100) &&
    sum >= 95 &&
    sum <= 105
  );
}

function resolveSliceAmount(
  slice: CanonicalPaymentTermSlice,
  projectValue: number | null | undefined,
  siblingCount: number
): number | null {
  const labelled = parseMoneyFromText(slice.description);
  let amount = slice.amount;
  if (labelled != null && (amount == null || isSequenceOrUnitAmount(amount, siblingCount))) {
    return labelled;
  }
  if (amount != null && isSequenceOrUnitAmount(amount, siblingCount)) {
    return equalShareOfProject(projectValue, siblingCount) ?? labelled ?? amount;
  }
  return amount ?? labelled;
}

function calibrateAmounts(
  slices: CanonicalPaymentTermSlice[],
  projectValue: number | null | undefined
): CanonicalPaymentTermSlice[] {
  if (slices.length === 0) return slices;
  const resolved = slices.map((slice) => ({
    ...slice,
    amount: resolveSliceAmount(slice, projectValue, slices.length),
  }));
  const amounts = resolved
    .map((slice) => slice.amount)
    .filter((amount): amount is number => amount != null && amount > 0);
  if (looksLikeEqualPercentages(amounts, resolved.length) && projectValue && projectValue > 0) {
    return resolved.map((slice, index) => ({
      ...slice,
      amount:
        slice.amount != null
          ? Math.round(projectValue * (slice.amount / 100) * 100) / 100
          : amounts[index] ?? slice.amount,
    }));
  }
  return resolved;
}

function fromCompensationTerm(
  term: ExtractedCompensationTerm,
  fallbackCurrency: string | null
): CanonicalPaymentTermSlice | null {
  if (!COMPENSATION_PAYMENT_TYPES.has(term.type)) return null;
  return {
    description: trimText(term.label.value) || trimText(term.rawSnippet),
    dueText: trimText(term.trigger.value) || trimText(term.deadline.value) || null,
    amount: asMoneyAmount(term.amount),
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
  const currency = trimText(result.currency?.value);
  const projectValue = asMoneyAmount(result.projectValue);
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
      amount: asMoneyAmount(term.amount),
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
      amount: asMoneyAmount(event.amount),
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

  return calibrateAmounts(
    overlayMissingTiming(preferred, agreementSettlementTiming(result)),
    projectValue
  );
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
