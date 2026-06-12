import { resolveCurrencyDisplayState } from '@/lib/ai-extractor/currency-display-state';

describe('resolveCurrencyDisplayState', () => {
  it('marks explicitly extracted high-confidence AUD as confirmed', () => {
    const state = resolveCurrencyDisplayState({
      extractedCurrency: 'AUD',
      extractedConfidence: 'high',
      workspaceCurrency: 'AUD',
    });
    expect(state.confidenceLabel).toBe('confirmed');
    expect(state.confidenceState).toBe('CONFIRMED');
    expect(state.displayLabel).toBe('AUD');
  });

  it('marks absent extraction currency as assumed workspace fallback', () => {
    const state = resolveCurrencyDisplayState({
      extractedCurrency: null,
      extractedConfidence: 'absent',
      workspaceCurrency: 'AUD',
    });
    expect(state.confidenceLabel).toBe('assumed');
    expect(state.confidenceState).toBe('ASSUMED');
    expect(state.displayLabel).toContain('Assumed AUD');
  });

  it('does not mark absent-confidence AUD value as confirmed', () => {
    const state = resolveCurrencyDisplayState({
      extractedCurrency: 'AUD',
      extractedConfidence: 'absent',
      workspaceCurrency: 'AUD',
    });
    expect(state.confidenceLabel).toBe('assumed');
    expect(state.confidenceState).toBe('ASSUMED');
  });

  it('marks ambiguous medium-confidence currency as unknown', () => {
    const state = resolveCurrencyDisplayState({
      extractedCurrency: 'USD',
      extractedConfidence: 'medium',
      workspaceCurrency: 'AUD',
    });
    expect(state.confidenceLabel).toBe('unknown');
    expect(state.displayLabel).toBe('Currency Unconfirmed');
  });
});
