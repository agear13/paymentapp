import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
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
  for (const term of result.paymentTerms ?? []) {
    if (
      textAlreadyHasEarlyPaymentDiscount(
        combineTermText(term.description.value, term.dueCondition.value)
      )
    ) {
      return true;
    }
  }

  for (const party of result.parties ?? []) {
    for (const payment of party.conditionalPayments ?? []) {
      if (textAlreadyHasEarlyPaymentDiscount(payment.trigger.value)) return true;
    }
    for (const term of party.compensationTerms ?? []) {
      if (term.type !== 'conditional_bonus') continue;
      const blob = `${term.label.value ?? ''} ${term.trigger.value ?? ''}`;
      if (textAlreadyHasEarlyPaymentDiscount(blob)) return true;
    }
  }

  return false;
}

function sourceDueLabel(days: number, raw: string | null): string {
  if (raw && /\bnet\s*[- ]?\d+/i.test(raw)) {
    return `Net ${days}`;
  }
  return `${days} days after delivery`;
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
  for (const [index, term] of (result.paymentTerms ?? []).entries()) {
    const text = combineTermText(term.description.value, term.dueCondition.value);
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
      description: term.description.value?.trim() || null,
      dueCondition: term.dueCondition.value?.trim() || null,
      amount: term.amount.value,
      currency: term.currency.value?.trim() || null,
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
