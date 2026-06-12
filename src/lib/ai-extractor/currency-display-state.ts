import type { CurrencyConfidenceState, ExtractionConfidence } from './extraction-types';
import {
  isSupportedCurrency,
  type SupportedProjectCurrency,
} from './review-form-types';
import { resolveReviewFormCurrency, type ReviewCurrencyContext } from '@/lib/currency/resolve-review-form-currency';

export type CurrencyConfidenceLabel = 'confirmed' | 'assumed' | 'unknown';

export type CurrencyDisplayState = {
  code: SupportedProjectCurrency;
  confidenceState: CurrencyConfidenceState;
  confidenceLabel: CurrencyConfidenceLabel;
  displayLabel: string;
  extractedConfidence: ExtractionConfidence;
};

function mapStateToLabel(state: CurrencyConfidenceState): CurrencyConfidenceLabel {
  if (state === 'CONFIRMED') return 'confirmed';
  if (state === 'ASSUMED') return 'assumed';
  return 'unknown';
}

export function resolveCurrencyConfidenceState(context: ReviewCurrencyContext): CurrencyConfidenceState {
  const extracted = context.extractedCurrency?.trim().toUpperCase() ?? '';
  const extractedConfidence = context.extractedConfidence ?? 'absent';

  if (isSupportedCurrency(extracted) && extractedConfidence === 'high') {
    return 'CONFIRMED';
  }

  if (extractedConfidence === 'absent' || !extracted) {
    return 'ASSUMED';
  }

  return 'UNKNOWN';
}

export function resolveCurrencyDisplayState(context: ReviewCurrencyContext): CurrencyDisplayState {
  const extracted = context.extractedCurrency?.trim().toUpperCase() ?? '';
  const extractedConfidence = context.extractedConfidence ?? 'absent';
  const code = resolveReviewFormCurrency(context);
  const confidenceState = resolveCurrencyConfidenceState(context);
  const confidenceLabel = mapStateToLabel(confidenceState);

  if (confidenceState === 'CONFIRMED') {
    return {
      code,
      confidenceState,
      confidenceLabel,
      displayLabel: extracted,
      extractedConfidence,
    };
  }

  if (confidenceState === 'ASSUMED') {
    return {
      code,
      confidenceState,
      confidenceLabel,
      displayLabel: `Assumed ${code} (requires confirmation)`,
      extractedConfidence,
    };
  }

  return {
    code,
    confidenceState,
    confidenceLabel,
    displayLabel: 'Currency Unconfirmed',
    extractedConfidence,
  };
}
