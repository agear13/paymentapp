'use client';

/**
 * Single agreement currency for the Hackathon Journey workflow demo.
 * Reuses extracted commercial terms — no hardcoded demo currency.
 */

import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import { resolveReviewFormCurrency } from '@/lib/currency/resolve-review-form-currency';
import { isHackathonJourneyEnabled } from '@/lib/journey/hackathon-journey';

export type WorkflowAgreementCommercial = {
  currency: string;
  amount: number;
};

export function resolveWorkflowAgreementCurrency(
  result: Pick<ExtractionResult, 'currency'> | null | undefined,
  fallback = 'AUD',
): string {
  if (!result) return fallback.toUpperCase();
  return resolveReviewFormCurrency({
    extractedCurrency: result.currency?.value,
    extractedConfidence: result.currency?.confidence,
  });
}

export function resolveWorkflowAgreementAmount(
  result: Pick<ExtractionResult, 'projectValue'> | null | undefined,
  fallback = 0,
): number {
  const value = result?.projectValue?.value;
  if (typeof value === 'number' && value > 0) return value;
  return fallback;
}

export function toWorkflowProjectValueCurrency(currency: string): 'AUD' | 'USD' {
  return currency.trim().toUpperCase() === 'USD' ? 'USD' : 'AUD';
}

export function formatWorkflowAgreementMoney(amount: number, currency: string): string {
  const code = currency.trim().toUpperCase();
  if (code === 'AUD') {
    return `A$${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  if (code === 'USD') {
    return `US$${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  return `${code} ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/** Agreement commercial terms when hackathon demo has an imported snapshot. */
export function resolveHackathonWorkflowCommercial(
  result: ExtractionResult | null | undefined,
  staticFallback: WorkflowAgreementCommercial,
): WorkflowAgreementCommercial | null {
  if (!isHackathonJourneyEnabled() || !result) return null;
  return {
    currency: resolveWorkflowAgreementCurrency(result, staticFallback.currency),
    amount: resolveWorkflowAgreementAmount(result, staticFallback.amount),
  };
}
