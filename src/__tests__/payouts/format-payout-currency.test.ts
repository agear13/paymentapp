import { formatPayoutCurrency } from '@/lib/payouts/format-payout-currency';

describe('formatPayoutCurrency', () => {
  it('uses obligation currency when provided', () => {
    const formatted = formatPayoutCurrency(200, 'AUD', 'USD');
    expect(formatted).toMatch(/200/);
    expect(formatted).not.toMatch(/US\$/);
    expect(formatted.toLowerCase()).toMatch(/a\$|aud/);
  });

  it('falls back to organization default when line currency missing', () => {
    const formatted = formatPayoutCurrency(200, null, 'AUD');
    expect(formatted).toMatch(/200/);
    expect(formatted.toLowerCase()).toMatch(/a\$|aud/);
  });
});
