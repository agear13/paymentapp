/**
 * Presentation of extracted client payment terms.
 * Does not invent amounts, dates, or a new obligation model.
 */

import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import { collectCanonicalPaymentTerms } from '@/lib/commercial-incentive/canonical-payment-terms';

export type ExtractedPaymentTermSlice = {
  description: string | null;
  amount: number | null;
  currency: string | null;
  dueCondition: string | null;
};

export type AgreementPaymentScheduleItem = {
  label: string;
  amount: number | null;
  dueLabel: string | null;
};

export type AgreementPaymentScheduleView = {
  milestoneCount: number;
  totalAmount: number | null;
  currency: string | null;
  equalMilestoneAmount: number | null;
  next: {
    index: number;
    label: string;
    amount: number | null;
    dueLabel: string | null;
  } | null;
  remainingCount: number;
  remainingAmount: number | null;
  items: AgreementPaymentScheduleItem[];
};

function finiteAmount(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}

export function agreementPaymentScheduleFromTerms(
  terms: ExtractedPaymentTermSlice[],
  projectValue?: number | null,
  projectCurrency?: string | null
): AgreementPaymentScheduleView | null {
  if (terms.length === 0) return null;

  const items: AgreementPaymentScheduleItem[] = terms.map((term, index) => ({
    label: term.description?.trim() || `Milestone ${index + 1}`,
    amount: finiteAmount(term.amount),
    dueLabel: term.dueCondition?.trim() || null,
  }));

  const amounts = items
    .map((item) => item.amount)
    .filter((amount): amount is number => amount != null);
  const allHaveAmounts = amounts.length === items.length;
  const equalMilestoneAmount =
    allHaveAmounts && amounts.every((amount) => amount === amounts[0]) ? amounts[0] : null;
  const totalFromTerms = allHaveAmounts
    ? amounts.reduce((sum, amount) => sum + amount, 0)
    : null;
  const totalAmount = totalFromTerms ?? finiteAmount(projectValue ?? null);
  const currency =
    terms.find((term) => term.currency?.trim())?.currency?.trim() ||
    projectCurrency?.trim() ||
    null;
  const first = items[0];
  const remainingCount = Math.max(0, items.length - 1);
  const remainingAmount =
    first.amount != null && totalAmount != null
      ? Math.round((totalAmount - first.amount) * 100) / 100
      : remainingCount > 0 && equalMilestoneAmount != null
        ? Math.round(equalMilestoneAmount * remainingCount * 100) / 100
        : null;

  return {
    milestoneCount: items.length,
    totalAmount,
    currency,
    equalMilestoneAmount,
    next: first
      ? {
          index: 1,
          label: first.label,
          amount: first.amount,
          dueLabel: first.dueLabel,
        }
      : null,
    remainingCount,
    remainingAmount,
    items,
  };
}

export function agreementPaymentScheduleFromExtraction(
  extraction: ExtractionResult | null | undefined
): AgreementPaymentScheduleView | null {
  if (!extraction) return null;
  const terms = collectCanonicalPaymentTerms(extraction).map((term) => ({
    description: term.description,
    amount: term.amount,
    currency: term.currency,
    dueCondition: term.dueText,
  }));
  return agreementPaymentScheduleFromTerms(
    terms,
    extraction.projectValue?.value,
    extraction.currency?.value
  );
}

export function formatScheduleMoney(
  amount: number | null | undefined,
  currency?: string | null
): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  const code = (currency?.trim() || 'AUD').toUpperCase();
  const prefix = code === 'AUD' ? 'A$' : `${code} `;
  return `${prefix}${amount.toLocaleString('en-AU', { maximumFractionDigits: 2 })}`;
}
