import type { SubscriptionPlan } from '@/lib/entitlements/types';

export const PLAN_RANK: Record<SubscriptionPlan, number> = {
  starter: 0,
  professional: 1,
  growth: 2,
  enterprise: 3,
};

export const STARTER_MAX_AGREEMENTS = 3;
export const STARTER_MAX_AI_IMPORTS = 3;

export function isSubscriptionPlan(value: string): value is SubscriptionPlan {
  return value === 'starter' || value === 'professional' || value === 'growth' || value === 'enterprise';
}

export function parseSubscriptionPlan(value: string | null | undefined): SubscriptionPlan | null {
  if (value && isSubscriptionPlan(value)) return value;
  return null;
}

/**
 * Stored plan parser. Unknown values are unentitled Professional, not Starter.
 * Historical Starter rows still parse as `starter`.
 */
export function normalizeSubscriptionPlan(value: string | null | undefined): SubscriptionPlan {
  return parseSubscriptionPlan(value) ?? 'professional';
}

export function hasMinimumPlan(current: SubscriptionPlan, required: SubscriptionPlan): boolean {
  return PLAN_RANK[current] >= PLAN_RANK[required];
}

export function requiredPlanLabel(plan: SubscriptionPlan): string {
  switch (plan) {
    case 'starter':
      return 'Starter';
    case 'professional':
      return 'Professional';
    case 'growth':
      return 'Growth';
    case 'enterprise':
      return 'Enterprise';
    default:
      return plan;
  }
}
