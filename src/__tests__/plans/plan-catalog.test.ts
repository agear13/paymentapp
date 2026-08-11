import {
  ENTITLEMENT_PRICING_MISMATCHES,
} from '@/lib/plans/entitlement-pricing-mismatches';
import {
  PLAN_CATALOG,
  PLAN_CATALOG_ORDER,
  getPlanCatalogEntry,
} from '@/lib/plans/plan-catalog';
import {
  EntitlementRequiredError,
  parseEntitlementRequiredPayload,
} from '@/lib/entitlements/entitlement-api-errors';
import { resolvePlanRecommendation } from '@/lib/entitlements/plan-recommendations';

describe('plan-catalog', () => {
  it('uses App_Pricing prices without legacy enterprise pricing', () => {
    expect(PLAN_CATALOG.professional.price).toBe('$49/month');
    expect(PLAN_CATALOG.growth.price).toBe('$149/month');
    expect(PLAN_CATALOG.enterprise.price).toBe('Contact Sales');
    expect(PLAN_CATALOG.enterprise.price).not.toContain('999');
  });

  it('includes Payment Links on Professional', () => {
    expect(PLAN_CATALOG.professional.features).toContain('Payment Links');
  });

  it('orders plans starter through enterprise', () => {
    expect(PLAN_CATALOG_ORDER).toEqual(['starter', 'professional', 'growth', 'enterprise']);
  });

  it('defaults unknown plan to starter', () => {
    expect(getPlanCatalogEntry('unknown').id).toBe('starter');
  });
});

describe('entitlement-pricing-mismatches', () => {
  it('documents automated settlement tracking discrepancy', () => {
    const mismatch = ENTITLEMENT_PRICING_MISMATCHES.find(
      (m) => m.id === 'automated_settlement_tracking'
    );
    expect(mismatch).toBeDefined();
    expect(mismatch?.backendEntitlement).toContain('Growth');
  });
});

describe('entitlement-api-errors', () => {
  it('parses ENTITLEMENT_REQUIRED payloads', () => {
    const payload = parseEntitlementRequiredPayload({
      code: 'ENTITLEMENT_REQUIRED',
      error: 'feature_gated',
      headline: 'Payment Links are available on Professional',
      message: 'Upgrade required',
      currentPlan: 'starter',
      requiredPlan: 'professional',
      feature: 'payment_links',
    });
    expect(payload?.feature).toBe('payment_links');
    const err = new EntitlementRequiredError(payload!);
    expect(err.userMessage).toBe('Upgrade required');
    expect(err.message).not.toBe('feature_gated');
  });

  it('rejects non-entitlement errors', () => {
    expect(parseEntitlementRequiredPayload({ error: 'Forbidden' })).toBeNull();
  });
});

describe('plan-recommendations', () => {
  it('recommends Professional when Stripe connected but payment_links denied', () => {
    const rec = resolvePlanRecommendation({
      currentPlan: 'starter',
      effectivePlan: 'starter',
      deniedFeatures: { payment_links: true },
      stripeConnectConfigured: true,
    });
    expect(rec?.recommendedPlan).toBe('professional');
    expect(rec?.body).toContain('Stripe');
  });
});
