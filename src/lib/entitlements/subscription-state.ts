import type { EntitlementContext, SubscriptionPlan, SubscriptionStatus } from '@/lib/entitlements/types';
import { hasMinimumPlan } from '@/lib/entitlements/plans';

/** Stripe subscription statuses that grant paid entitlements. */
const ACTIVE_PAID_STATUSES: SubscriptionStatus[] = ['active', 'trialing'];

/**
 * True when the workspace has a confirmed Stripe subscription in good standing.
 * Enterprise is sales-assigned and does not require Stripe.
 */
export function hasActivePaidSubscription(ctx: EntitlementContext): boolean {
  if (ctx.plan === 'enterprise') return true;
  if (ctx.plan !== 'professional' && ctx.plan !== 'growth') return false;
  if (!ctx.stripeSubscriptionId) return false;
  return ACTIVE_PAID_STATUSES.includes(ctx.status);
}

/**
 * Plan used for entitlement evaluation. Lapsed paid plans fall back to Starter limits.
 */
export function getEffectivePlan(ctx: EntitlementContext): SubscriptionPlan {
  if (ctx.pilotBypass) return ctx.plan;
  if (ctx.plan === 'enterprise') return 'enterprise';
  if (ctx.plan === 'starter') return 'starter';
  if (hasActivePaidSubscription(ctx)) return ctx.plan;
  return 'starter';
}

export function requiresPaidSubscription(plan: SubscriptionPlan): boolean {
  return plan === 'professional' || plan === 'growth';
}

export function isPaidFeatureAllowed(
  ctx: EntitlementContext,
  requiredPlan: SubscriptionPlan
): boolean {
  if (ctx.pilotBypass) return true;
  const effectivePlan = getEffectivePlan(ctx);
  if (!hasMinimumPlan(effectivePlan, requiredPlan)) return false;
  if (requiresPaidSubscription(requiredPlan) && !hasActivePaidSubscription(ctx)) {
    return false;
  }
  return true;
}
