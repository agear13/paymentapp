import { LANDING_PROVIDER_OFFERINGS } from '@/lib/journey/landing-provider-catalog';
import {
  buildIndicativePricing,
  formatIndicativeRange,
  pricingFreshnessLabel,
  relativeTimestamp,
} from '@/lib/journey/landing-provider-pricing';

describe('indicative pricing', () => {
  const wise = LANDING_PROVIDER_OFFERINGS.find((item) => item.id === 'wise-international');

  it('shows a rounded range instead of fake cents', () => {
    expect(wise).toBeDefined();
    const pricing = buildIndicativePricing(wise!, 10000, 'AUD');
    expect(pricing.type).toBe('indicative');
    expect(pricing.timestamp).toBeNull();
    expect(pricing.totalLabel).toMatch(/^~/);
    expect(pricing.totalLabel).not.toMatch(/\d+\.\d{2}/);
    expect(pricing.fxLabel).toMatch(/FX cost/i);
  });

  it('formats ranges without inventing precision', () => {
    expect(formatIndicativeRange(73, 98, 'AUD')).toMatch(/–/);
    expect(formatIndicativeRange(73, 98, 'AUD')).not.toMatch(/\.\d{2}/);
  });

  it('can display live freshness later without a redesign', () => {
    expect(pricingFreshnessLabel({
      type: 'indicative',
      currency: 'AUD',
      amount: 80,
      fee: null,
      fx: 80,
      timestamp: null,
      totalLabel: '~A$80',
      feeLabel: null,
      fxLabel: 'FX cost ~A$80',
    })).toBe('Indicative');

    expect(
      pricingFreshnessLabel({
        type: 'live',
        currency: 'AUD',
        amount: 80,
        fee: null,
        fx: 80,
        timestamp: new Date(Date.now() - 12_000).toISOString(),
        totalLabel: 'A$80',
        feeLabel: null,
        fxLabel: null,
      })
    ).toMatch(/Live · updated 12 sec ago/);
  });

  it('renders relative timestamps for a future live quote', () => {
    expect(relativeTimestamp(new Date(Date.now() - 12_000).toISOString())).toBe('12 sec ago');
  });
});
