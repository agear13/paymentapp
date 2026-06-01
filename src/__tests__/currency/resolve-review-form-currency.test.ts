import { resolveReviewFormCurrency } from '@/lib/currency/resolve-review-form-currency';
import { PLATFORM_FALLBACK_CURRENCY } from '@/lib/currency/resolve-catalog-default-currency';

describe('resolveReviewFormCurrency (1E / 1F)', () => {
  it('prefers explicit supported extraction', () => {
    expect(
      resolveReviewFormCurrency({
        extractedCurrency: 'USD',
        extractedConfidence: 'high',
        project: { projectValueCurrency: 'AUD' },
        workspaceCurrency: 'EUR',
      })
    ).toBe('USD');
  });

  it('falls back to project currency when extraction is absent', () => {
    expect(
      resolveReviewFormCurrency({
        extractedCurrency: null,
        extractedConfidence: 'absent',
        project: { projectValueCurrency: 'USD' },
        workspaceCurrency: 'AUD',
      })
    ).toBe('USD');
  });

  it('falls back to workspace then platform default', () => {
    expect(
      resolveReviewFormCurrency({
        extractedCurrency: 'IDR',
        extractedConfidence: 'high',
        project: null,
        workspaceCurrency: 'AUD',
      })
    ).toBe('AUD');

    expect(
      resolveReviewFormCurrency({
        extractedCurrency: null,
        extractedConfidence: 'absent',
        project: null,
        workspaceCurrency: null,
      })
    ).toBe(PLATFORM_FALLBACK_CURRENCY);
  });
});
