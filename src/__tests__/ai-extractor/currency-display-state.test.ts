import { resolveCurrencyDisplayState } from '@/lib/ai-extractor/currency-display-state';

describe('resolveCurrencyDisplayState', () => {
  it('marks explicitly extracted AUD as confirmed', () => {
    const state = resolveCurrencyDisplayState({
      extractedCurrency: 'AUD',
      extractedConfidence: 'high',
      workspaceCurrency: 'AUD',
    });
    expect(state.confidenceLabel).toBe('confirmed');
    expect(state.displayLabel).toBe('AUD');
  });

  it('marks absent extraction currency as assumed workspace fallback', () => {
    const state = resolveCurrencyDisplayState({
      extractedCurrency: null,
      extractedConfidence: 'absent',
      workspaceCurrency: 'AUD',
    });
    expect(state.confidenceLabel).toBe('assumed');
    expect(state.displayLabel).toContain('Assumed AUD');
  });
});
