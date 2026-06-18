import type { ExtractionField } from './extraction-types';
// Import from the currency domain leaf, not from review-form-types, to break
// the extraction-currency ↔ review-form-types circular dependency.
import { isSupportedCurrency } from './currency/supported-currencies';

/** True when extraction explicitly named a non-AUD/USD ISO currency (not absent/unknown). */
export function isExtractedCurrencyExplicitlyUnsupported(
  currency: ExtractionField<string | null>
): boolean {
  const raw = currency.value?.trim().toUpperCase() ?? '';
  if (currency.confidence === 'absent' || !raw) return false;
  return !isSupportedCurrency(raw);
}

export function extractedCurrencyDisplayCode(
  currency: ExtractionField<string | null>
): string | null {
  const raw = currency.value?.trim();
  if (!raw || currency.confidence === 'absent') return null;
  return raw.toUpperCase();
}
