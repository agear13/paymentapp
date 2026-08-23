import type { EntitlementContext, SubscriptionPlan, SubscriptionStatus } from '@/lib/entitlements/types';
import { hasMinimumPlan } from '@/lib/entitlements/plans';

/** Stripe subscription statuses that grant paid entitlements. */
const ACTIVE_PAID_STATUSES: SubscriptionStatus[] = ['active', 'trialing'];

function trialEndMs(ctx: EntitlementContext): number | null {
  const end = ctx.trialEndsAt;
  if (!end) return null;
  return end.getTime();
}

/**
 * Cardless Professional Trial started at journey workspace creation.
 * Stripe-managed orgs are never evaluated on this path.
 */
export function hasActiveFirstPartyTrial(ctx: EntitlementContext, now: Date = new Date()): boolean {
  if (ctx.stripeSubscriptionId) return false;
  if (ctx.plan !== 'professional') return false;
  if (ctx.status !== 'trialing') return false;
  const endsAt = trialEndMs(ctx);
  if (endsAt == null) return false;
  return now.getTime() < endsAt;
}

/**
 * Journey Professional Trial whose clock has elapsed, with no Stripe subscription.
 */
export function isExpiredFirstPartyTrial(ctx: EntitlementContext, now: Date = new Date()): boolean {
  if (ctx.stripeSubscriptionId) return false;
  if (ctx.plan !== 'professional') return false;
  const endsAt = trialEndMs(ctx);
  if (endsAt == null) return false;
  return now.getTime() >= endsAt;
}

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

/** Paid Stripe subscription or unexpired first-party Professional Trial. */
export function hasEntitledPlanAccess(ctx: EntitlementContext, now: Date = new Date()): boolean {
  return hasActivePaidSubscription(ctx) || hasActiveFirstPartyTrial(ctx, now);
}

/**
 * Plan used for entitlement evaluation.
 * Legacy Starter orgs stay Starter.
 * Expired first-party trials and cancelled paid plans keep their stored plan
 * for display. Evaluators deny access without mapping the workspace to Starter.
 */
export function getEffectivePlan(ctx: EntitlementContext, now: Date = new Date()): SubscriptionPlan {
  if (ctx.pilotBypass) return ctx.plan;
  if (ctx.plan === 'enterprise') return 'enterprise';
  if (ctx.plan === 'starter') return 'starter';
  if (hasActivePaidSubscription(ctx)) return ctx.plan;
  if (hasActiveFirstPartyTrial(ctx, now)) return ctx.plan;
  if (isExpiredFirstPartyTrial(ctx, now)) return ctx.plan;
  return ctx.plan;
}

export function requiresPaidSubscription(plan: SubscriptionPlan): boolean {
  return plan === 'professional' || plan === 'growth';
}

export function isPaidFeatureAllowed(
  ctx: EntitlementContext,
  requiredPlan: SubscriptionPlan,
  now: Date = new Date()
): boolean {
  if (ctx.pilotBypass) return true;
  if (isExpiredFirstPartyTrial(ctx, now)) return false;
  const effectivePlan = getEffectivePlan(ctx, now);
  if (!hasMinimumPlan(effectivePlan, requiredPlan)) return false;
  if (requiresPaidSubscription(requiredPlan) && !hasEntitledPlanAccess(ctx, now)) {
    return false;
  }
  return true;
}
