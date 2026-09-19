/**
 * Presentation-only money for review settlement cards.
 * Reuses the existing canonical payment-term adapter. Does not write extraction_result
 * and does not copy milestone amounts onto participant.fixedAmount.
 */

import type {
  ExtractedCompensationTerm,
  ExtractedParty,
  ExtractionResult,
} from '@/lib/ai-extractor/extraction-types';
import {
  collectCanonicalPaymentTerms,
  parseMoneyFromText,
} from '@/lib/commercial-incentive/canonical-payment-terms';

const PAYMENT_TERM_TYPES = new Set(['instalment', 'milestone', 'fixed_fee']);

export function isLikelySequenceOrUnitAmount(
  amount: number,
  siblingCount: number
): boolean {
  if (!Number.isInteger(amount) || amount <= 0) return false;
  if (amount === 1) return true;
  return siblingCount >= 2 && amount <= siblingCount;
}

export function displayableCompensationAmount(
  rawAmount: number | null | undefined,
  siblingCount: number,
  label?: string | null,
  calibratedAmount?: number | null
): number | null {
  const labelled = parseMoneyFromText(label);
  if (rawAmount != null && isLikelySequenceOrUnitAmount(rawAmount, siblingCount)) {
    if (
      calibratedAmount != null &&
      !isLikelySequenceOrUnitAmount(calibratedAmount, siblingCount)
    ) {
      return calibratedAmount;
    }
    return labelled;
  }
  if (rawAmount != null && Number.isFinite(rawAmount) && rawAmount > 0) {
    return rawAmount;
  }
  if (
    calibratedAmount != null &&
    !isLikelySequenceOrUnitAmount(calibratedAmount, siblingCount)
  ) {
    return calibratedAmount;
  }
  return labelled;
}

export function calibratedCompensationAmountsForParty(
  party: ExtractedParty,
  result: ExtractionResult
): Array<{ term: ExtractedCompensationTerm; amount: number | null }> {
  const terms = (party.compensationTerms ?? []).filter((term) =>
    PAYMENT_TERM_TYPES.has(term.type)
  );
  const calibrated = collectCanonicalPaymentTerms({
    ...result,
    parties: [party],
    paymentTerms: [],
    settlementEvents: [],
  });

  return terms.map((term, index) => ({
    term,
    amount: displayableCompensationAmount(
      term.amount.value,
      terms.length,
      term.label.value,
      calibrated[index]?.amount ?? null
    ),
  }));
}
