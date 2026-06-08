import type { SubscriptionPlan } from '@/lib/entitlements/types';

export const SAAS_BILLING_CHECKOUT_TYPE = 'saas_subscription';

export const PAID_STRIPE_PLANS = ['professional', 'growth'] as const;
export type PaidStripePlan = (typeof PAID_STRIPE_PLANS)[number];

export function isPaidStripePlan(value: string): value is PaidStripePlan {
  return value === 'professional' || value === 'growth';
}

export function getStripePriceIdForPlan(plan: PaidStripePlan): string | null {
  const priceId =
    plan === 'professional'
      ? process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY
      : process.env.STRIPE_PRICE_GROWTH_MONTHLY;
  const trimmed = priceId?.trim();
  return trimmed || null;
}

export function planFromStripePriceId(priceId: string | null | undefined): PaidStripePlan | null {
  if (!priceId) return null;
  const professional = process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY?.trim();
  const growth = process.env.STRIPE_PRICE_GROWTH_MONTHLY?.trim();
  if (professional && priceId === professional) return 'professional';
  if (growth && priceId === growth) return 'growth';
  return null;
}

export function paidPlanMonthlyAmount(plan: PaidStripePlan): number {
  return plan === 'professional' ? 49 : 149;
}

export function isStripeBillingConfigured(): boolean {
  return Boolean(getStripePriceIdForPlan('professional') && getStripePriceIdForPlan('growth'));
}
