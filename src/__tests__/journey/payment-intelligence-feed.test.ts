import { PAYMENT_INTELLIGENCE_FEED } from '@/lib/journey/payment-intelligence-feed';
import {
  corridorFit,
  developmentsForAdvisor,
  intelligenceSnapshotLabel,
  rankPaymentIntelligence,
  searchHintForItem,
  thisMattersBecause,
  watchlistForScope,
} from '@/lib/journey/payment-intelligence-rank';
import type { PaymentIntelligenceSignal } from '@/lib/journey/payment-intelligence-types';

describe('payment intelligence catalog', () => {
  it('only contains sourced catalog items, never live network claims', () => {
    expect(PAYMENT_INTELLIGENCE_FEED.length).toBeGreaterThanOrEqual(3);
    for (const item of PAYMENT_INTELLIGENCE_FEED) {
      expect(item.sourceUrl).toMatch(/^https:\/\//);
      expect(item.confidence).toBe('catalog');
      expect(item.freshness).toBe('catalog_snapshot');
      expect(item.signal).toMatch(
        /^(regulatory_momentum|corridor_expansion|provider_adoption|availability_change|regulatory_uncertainty|no_material_change)$/
      );
      expect(item.headline).not.toMatch(/live quote|live FX|transaction volume|real-time market/i);
      expect(item.pulseLabel).not.toMatch(/transaction volume|live market|updated \d+ minutes/i);
      expect(item.businessImpact).not.toMatch(/we can see your|your cash balance/i);
    }
    expect(intelligenceSnapshotLabel()).toMatch(/snapshot/i);
    expect(intelligenceSnapshotLabel()).not.toMatch(/minutes ago|live payment network/i);
  });

  it('ranks Australian developments higher for an Australia → Indonesia corridor', () => {
    const ranked = rankPaymentIntelligence({
      origin: 'AU',
      destination: 'ID',
      scope: 'all',
    });
    expect(ranked.items[0]?.countries).toContain('AU');
    expect(ranked.watching.map((item) => item.title)).toEqual([
      'FX',
      'Settlement speed',
      'Regulatory / rail availability',
    ]);
    expect(ranked.snapshotLabel).toContain('Payment intelligence');
  });

  it('changes the watchlist when the visitor narrows to Australia', () => {
    const all = watchlistForScope('all');
    const australia = watchlistForScope('australia');
    expect(all).toHaveLength(10);
    expect(australia.some((item) => item.id === 'npp')).toBe(true);
    expect(australia.find((item) => item.id === 'swift')?.movement).toBe('up');
    expect(australia.find((item) => item.id === 'swift')?.movementReason).toMatch(/framework/i);
  });

  it('exposes corridor developments for the Advisor without claiming connected data', () => {
    const developments = developmentsForAdvisor({
      origin: 'AU',
      destination: 'ID',
      scope: 'all',
    });
    expect(developments.length).toBe(3);
    expect(developments.some((item) => /regulat/i.test(item.headline))).toBe(true);
    expect(JSON.stringify(developments)).not.toMatch(/live pricing|your Wise account/i);
  });

  it('maps sourced items to search hints without inventing volume or live prices', () => {
    const swift = PAYMENT_INTELLIGENCE_FEED.find((item) => item.id === 'swift-retail-framework-2026-03');
    const regulation = PAYMENT_INTELLIGENCE_FEED.find((item) => item.id === 'rba-psr-review-2026-06');
    const digital = PAYMENT_INTELLIGENCE_FEED.find((item) => item.id === 'bis-agora-rvt-2026-07');
    expect(swift && searchHintForItem(swift)).toEqual({
      paymentMethods: ['bank_transfer'],
      priority: null,
    });
    expect(regulation && searchHintForItem(regulation)).toEqual({
      paymentMethods: [],
      priority: null,
    });
    expect(digital && searchHintForItem(digital)).toEqual({
      paymentMethods: ['stablecoin'],
      priority: 'fastest',
    });
    expect(regulation && thisMattersBecause(regulation)).toMatch(/^This matters because/);
    expect(regulation && corridorFit(regulation, 'AU', 'ID')).toBe('direct');
    expect(digital && corridorFit(digital, 'AU', 'ID')).toBe('cross_border');
    const signals = new Set(PAYMENT_INTELLIGENCE_FEED.map((item) => item.signal));
    expect(signals.size).toBeGreaterThanOrEqual(3);
    const allowed: PaymentIntelligenceSignal[] = [
      'regulatory_momentum',
      'corridor_expansion',
      'provider_adoption',
      'availability_change',
      'regulatory_uncertainty',
      'no_material_change',
    ];
    for (const signal of signals) {
      expect(allowed).toContain(signal);
    }
  });
});
