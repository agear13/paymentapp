import {
  formatCompactCurrency,
  formatCurrency,
  formatCurrencyWithoutSymbol,
} from '@/lib/formatters/format-currency';

describe('formatCurrency', () => {
  it('formats USD amounts', () => {
    expect(formatCurrency(1000, 'USD')).toMatch(/1,000\.00/);
  });

  it('handles null and undefined safely', () => {
    expect(formatCurrency(null, 'USD')).toBe('—');
    expect(formatCurrency(undefined, 'USD')).toBe('—');
  });

  it('falls back when currency is missing', () => {
    expect(formatCurrency(10, null)).toMatch(/10\.00/);
  });

  it('formats compact currency', () => {
    expect(formatCompactCurrency(1250, 'USD')).toMatch(/1\.3K|1,250|\$1\.3K/i);
  });

  it('formats without symbol', () => {
    expect(formatCurrencyWithoutSymbol(42.5)).toBe('42.50');
  });
});
