import type { ExtractionConfidence } from './extraction-types';
import {
  isSupportedCurrency,
  type SupportedProjectCurrency,
} from './review-form-types';
import { resolveReviewFormCurrency, type ReviewCurrencyContext } from '@/lib/currency/resolve-review-form-currency';

export type CurrencyConfidenceLabel = 'confirmed' | 'assumed' | 'unknown';

export type CurrencyDisplayState = {
  code: SupportedProjectCurrency;
  confidenceLabel: CurrencyConfidenceLabel;
  displayLabel: string;
  extractedConfidence: ExtractionConfidence;
};

export function resolveCurrencyDisplayState(context: ReviewCurrencyContext): CurrencyDisplayState {
  const extracted = context.extractedCurrency?.trim().toUpperCase() ?? '';
  const extractedConfidence = context.extractedConfidence ?? 'absent';
  const code = resolveReviewFormCurrency(context);

  if (isSupportedCurrency(extracted) && extractedConfidence !== 'absent') {
    return {
      code,
      confidenceLabel: 'confirmed',
      displayLabel: extracted,
      extractedConfidence,
    };
  }

  if (extractedConfidence === 'absent' || !extracted) {
    return {
      code,
      confidenceLabel: 'assumed',
      displayLabel: `Assumed ${code} (requires confirmation)`,
      extractedConfidence,
    };
  }

  return {
    code,
    confidenceLabel: 'unknown',
    displayLabel: 'Unconfirmed',
    extractedConfidence,
  };
}
