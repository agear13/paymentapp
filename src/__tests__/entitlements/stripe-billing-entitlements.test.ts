import {
  canCreatePaymentLinks,
  canUseAdvancedReporting,
  canUseReferralManagement,
} from '@/lib/entitlements/workspace-entitlements';
import {
  getEffectivePlan,
  hasActivePaidSubscription,
} from '@/lib/entitlements/subscription-state';
import type { EntitlementContext } from '@/lib/entitlements/types';

function ctx(overrides: Partial<EntitlementContext> = {}): EntitlementContext {
  return {
    organizationId: 'org-1',
    userId: 'user-1',
    productProfile: 'standard',
    plan: 'starter',
    status: 'inactive',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
    usage: {
      agreementCount: 0,
      aiImportCount: 0,
      teamMemberCount: 1,
      workspaceCount: 1,
    },
    pilotBypass: false,
    ...overrides,
  };
}

function paidCtx(
  plan: 'professional' | 'growth',
  overrides: Partial<EntitlementContext> = {}
): EntitlementContext {
  return ctx({
    plan,
    status: 'active',
    stripeCustomerId: 'cus_test',
    stripeSubscriptionId: 'sub_test',
    currentPeriodEnd: new Date('2026-07-01T00:00:00Z'),
    ...overrides,
  });
}

describe('Stripe billing entitlements', () => {
  it('treats orgs without Stripe subscription as Starter for paid features', () => {
    const dangling = ctx({ plan: 'professional', status: 'active' });
    expect(hasActivePaidSubscription(dangling)).toBe(false);
    expect(getEffectivePlan(dangling)).toBe('starter');
    expect(canCreatePaymentLinks(dangling).allowed).toBe(false);
  });

  it('grants Professional features with active Stripe subscription', () => {
    const pro = paidCtx('professional');
    expect(hasActivePaidSubscription(pro)).toBe(true);
    expect(getEffectivePlan(pro)).toBe('professional');
    expect(canCreatePaymentLinks(pro).allowed).toBe(true);
    expect(canUseReferralManagement(pro).allowed).toBe(true);
  });

  it('denies Growth features on Professional subscription', () => {
    const pro = paidCtx('professional');
    expect(canUseAdvancedReporting(pro).allowed).toBe(false);
  });

  it('grants Growth features with active Growth Stripe subscription', () => {
    const growth = paidCtx('growth');
    expect(canUseAdvancedReporting(growth).allowed).toBe(true);
  });

  it('revokes paid features when subscription is past_due', () => {
    const lapsed = paidCtx('professional', { status: 'past_due' });
    expect(hasActivePaidSubscription(lapsed)).toBe(false);
    expect(canCreatePaymentLinks(lapsed).allowed).toBe(false);
    expect(canCreatePaymentLinks(lapsed).reason).toBe('subscription_inactive');
  });

  it('leaves Rabbit Hole pilot bypass unchanged', () => {
    const pilot = ctx({
      productProfile: 'rabbit_hole_pilot',
      pilotBypass: true,
      plan: 'starter',
      status: 'inactive',
    });
    expect(canCreatePaymentLinks(pilot).allowed).toBe(true);
    expect(canUseAdvancedReporting(pilot).allowed).toBe(true);
  });
});
