import type { EntitlementFeature, SubscriptionPlan, WorkspaceUsage } from '@/lib/entitlements/types';
import { STARTER_MAX_AGREEMENTS } from '@/lib/entitlements/plans';
import { getPlanCatalogEntry } from '@/lib/plans/plan-catalog';

export type PlanRecommendationInput = {
  currentPlan: SubscriptionPlan;
  effectivePlan: SubscriptionPlan;
  usage?: WorkspaceUsage;
  deniedFeatures?: Partial<Record<EntitlementFeature, boolean>>;
  stripeConnectConfigured?: boolean;
};

export type PlanRecommendation = {
  recommendedPlan: SubscriptionPlan;
  headline: string;
  body: string;
  cta: string;
  contactSales?: boolean;
};

/**
 * Deterministic plan recommendations — never grants entitlements.
 */
export function resolvePlanRecommendation(
  input: PlanRecommendationInput
): PlanRecommendation | null {
  const denied = input.deniedFeatures ?? {};

  if (
    denied.payment_links &&
    input.stripeConnectConfigured &&
    input.effectivePlan === 'starter'
  ) {
    const plan = getPlanCatalogEntry('professional');
    return {
      recommendedPlan: 'professional',
      headline: `${plan.name} — ${plan.price}`,
      body:
        "You're already connected to Stripe. Professional unlocks Payment Links and automated settlement tracking.",
      cta: 'Upgrade to Professional',
    };
  }

  if (denied.payment_links && input.effectivePlan === 'starter') {
    const plan = getPlanCatalogEntry('professional');
    return {
      recommendedPlan: 'professional',
      headline: `${plan.name} — ${plan.price}`,
      body: `${plan.positioning} Upgrade to unlock Payment Links.`,
      cta: 'Upgrade to Professional',
    };
  }

  const agreementCount = input.usage?.agreementCount ?? 0;
  if (
    input.effectivePlan === 'starter' &&
    agreementCount >= STARTER_MAX_AGREEMENTS - 1
  ) {
    return {
      recommendedPlan: 'professional',
      headline: 'Professional — $49/month',
      body: `You've used ${agreementCount} of ${STARTER_MAX_AGREEMENTS} Starter agreements. Professional includes unlimited agreements.`,
      cta: 'Upgrade to Professional',
    };
  }

  const teamMembers = input.usage?.teamMemberCount ?? 1;
  if (
    teamMembers > 1 &&
    (input.effectivePlan === 'starter' || input.effectivePlan === 'professional')
  ) {
    const plan = getPlanCatalogEntry('growth');
    return {
      recommendedPlan: 'growth',
      headline: `${plan.name} — ${plan.price}`,
      body: 'Your workspace has multiple team members. Growth adds multi-user workspaces and team collaboration.',
      cta: 'Upgrade to Growth',
    };
  }

  if (
    denied.multi_organisation ||
    denied.api_access ||
    denied.custom_workflows ||
    denied.custom_settlement_rules
  ) {
    const plan = getPlanCatalogEntry('enterprise');
    return {
      recommendedPlan: 'enterprise',
      headline: plan.name,
      body: plan.positioning,
      cta: 'Contact Sales',
      contactSales: true,
    };
  }

  if (input.effectivePlan === 'starter') {
    return {
      recommendedPlan: 'professional',
      headline: 'Professional — $49/month',
      body: getPlanCatalogEntry('professional').positioning,
      cta: 'Upgrade to Professional',
    };
  }

  if (input.effectivePlan === 'professional') {
    return {
      recommendedPlan: 'growth',
      headline: 'Growth — $149/month',
      body: getPlanCatalogEntry('growth').positioning,
      cta: 'Upgrade to Growth',
    };
  }

  return null;
}
