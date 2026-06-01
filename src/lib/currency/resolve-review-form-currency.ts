import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { ExtractionConfidence } from '@/lib/ai-extractor/extraction-types';
import { PLATFORM_FALLBACK_CURRENCY } from '@/lib/currency/resolve-catalog-default-currency';
import {
  isSupportedCurrency,
  type SupportedProjectCurrency,
} from '@/lib/ai-extractor/review-form-types';

export type ReviewCurrencyContext = {
  extractedCurrency: string | null | undefined;
  extractedConfidence?: ExtractionConfidence;
  project?: Pick<RecentDeal, 'projectValueCurrency'> | null;
  workspaceCurrency?: string | null;
};

/**
 * Currency hierarchy for AI review and recurring surfaces:
 * explicit extraction → project → workspace → system default.
 */
export function resolveReviewFormCurrency(context: ReviewCurrencyContext): SupportedProjectCurrency {
  const extracted = context.extractedCurrency?.trim().toUpperCase() ?? '';
  const confidence = context.extractedConfidence ?? 'high';

  if (
    isSupportedCurrency(extracted) &&
    confidence !== 'absent' &&
    extracted.length > 0
  ) {
    return extracted;
  }

  const projectCurrency = context.project?.projectValueCurrency;
  if (isSupportedCurrency(projectCurrency)) {
    return projectCurrency;
  }

  const workspace = context.workspaceCurrency?.trim().toUpperCase() ?? '';
  if (isSupportedCurrency(workspace)) {
    return workspace;
  }

  if (isSupportedCurrency(PLATFORM_FALLBACK_CURRENCY)) {
    return PLATFORM_FALLBACK_CURRENCY;
  }

  return 'AUD';
}
