/**
 * Leaf module — no imports within ai-extractor.
 * Both extraction-currency and review-form-types consume this.
 * It must never import either of those modules (that would recreate the cycle).
 *
 * Single source of truth for which currencies the platform can store and
 * calculate with. Moving this here breaks the extraction-currency ↔
 * review-form-types circular dependency.
 */

export const SUPPORTED_PROJECT_CURRENCIES = ['AUD', 'USD'] as const;
export type SupportedProjectCurrency = (typeof SUPPORTED_PROJECT_CURRENCIES)[number];

export function isSupportedCurrency(
  code: string | null | undefined
): code is SupportedProjectCurrency {
  return SUPPORTED_PROJECT_CURRENCIES.includes(code as SupportedProjectCurrency);
}
