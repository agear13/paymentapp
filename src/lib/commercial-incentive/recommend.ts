import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import {
  collectCanonicalPaymentTerms,
} from '@/lib/commercial-incentive/canonical-payment-terms';
import {
  combineTermText,
  parseDelayedPaymentDays,
  textAlreadyHasEarlyPaymentDiscount,
} from '@/lib/commercial-incentive/detect-delayed-terms';
import { calculateEarlyPaymentEconomics } from '@/lib/commercial-incentive/economics';
import { EARLY_PAYMENT_INCENTIVE_POLICY } from '@/lib/commercial-incentive/policy';
import {
  EARLY_PAYMENT_COMPENSATION_TYPE,
  EARLY_PAYMENT_INCENTIVE_KIND,
  EARLY_PAYMENT_ORIGIN,
  type DelayedPaymentTermMatch,
  type EarlyPaymentIncentiveRecommendation,
} from '@/lib/commercial-incentive/types';

function extractionAlreadyHasEarlyDiscount(result: ExtractionResult): boolean {
  const blobs: string[] = [];

  for (const term of result.paymentTerms ?? []) {
    blobs.push(combineTermText(term.description?.value, term.dueCondition?.value));
  }

  for (const party of result.parties ?? []) {
    for (const payment of party.conditionalPayments ?? []) {
      blobs.push(payment.trigger.value ?? '');
    }
    for (const term of party.compensationTerms ?? []) {
      blobs.push(`${term.label.value ?? ''} ${term.trigger.value ?? ''}`);
    }
  }

  for (const rule of result.settlementRules ?? []) {
    blobs.push(`${rule.trigger.value ?? ''} ${rule.basis.value ?? ''}`);
  }

  for (const event of result.settlementEvents ?? []) {
    blobs.push(`${event.trigger.value ?? ''} ${event.condition.value ?? ''}`);
  }

  return blobs.some((blob) => textAlreadyHasEarlyPaymentDiscount(blob));
}

function sourceDueLabel(days: number, raw: string | null): string {
  if (raw && /\bnet\s*[- ]?\d+/i.test(raw)) {
    return `Net ${days}`;
  }
  if (raw && /\bwithin\s+\d{1,3}\s*days/i.test(raw)) {
    return `Net ${days}`;
  }
  return raw?.trim() || `${days} days after delivery`;
}

/**
 * Deterministic early-payment recommendation from extracted payment terms.
 * Returns null rather than inventing timing or milestone amounts.
 */
export function recommendEarlyPaymentIncentive(
  result: ExtractionResult | null | undefined
): EarlyPaymentIncentiveRecommendation | null {
  if (!result) return null;
  if (extractionAlreadyHasEarlyDiscount(result)) return null;

  const delayedTerms: DelayedPaymentTermMatch[] = [];
  for (const [index, slice] of collectCanonicalPaymentTerms(result).entries()) {
    const text = combineTermText(slice.description, slice.dueText);
    const delayedDays = parseDelayedPaymentDays(text);
    if (
      delayedDays == null ||
      delayedDays < EARLY_PAYMENT_INCENTIVE_POLICY.minDelayedDays ||
      delayedDays <= EARLY_PAYMENT_INCENTIVE_POLICY.acceleratedDays
    ) {
      continue;
    }
    delayedTerms.push({
      index,
      description: slice.description,
      dueCondition: slice.dueText,
      amount: slice.amount,
      currency: slice.currency,
      delayedDays,
    });
  }

  if (delayedTerms.length === 0) return null;

  const standardDays = delayedTerms[0].delayedDays;
  const currency =
    delayedTerms.find((term) => term.currency)?.currency ??
    result.currency.value?.trim() ??
    null;
  const milestoneAmounts = delayedTerms
    .map((term) => term.amount)
    .filter((amount): amount is number => amount != null && Number.isFinite(amount) && amount > 0);

  const economics = calculateEarlyPaymentEconomics({
    milestoneAmounts,
    currency,
    standardDays,
  });

  const firstRaw = delayedTerms[0].dueCondition ?? delayedTerms[0].description;
  const dueLabel = sourceDueLabel(standardDays, firstRaw);
  const trigger = `Paid within ${EARLY_PAYMENT_INCENTIVE_POLICY.acceleratedDays} days`;
  const label = `${EARLY_PAYMENT_INCENTIVE_POLICY.incentivePercent}% discount if paid within ${EARLY_PAYMENT_INCENTIVE_POLICY.acceleratedDays} days`;

  return {
    kind: EARLY_PAYMENT_INCENTIVE_KIND,
    origin: EARLY_PAYMENT_ORIGIN,
    status: 'proposed',
    compensationType: EARLY_PAYMENT_COMPENSATION_TYPE,
    policyId: EARLY_PAYMENT_INCENTIVE_POLICY.id,
    standardDays,
    acceleratedDays: EARLY_PAYMENT_INCENTIVE_POLICY.acceleratedDays,
    incentivePercent: EARLY_PAYMENT_INCENTIVE_POLICY.incentivePercent,
    sourceDueLabel: dueLabel,
    delayedTerms,
    economics,
    trigger,
    label,
  };
}
