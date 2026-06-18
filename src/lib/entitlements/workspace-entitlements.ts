import type {
  EntitlementContext,
  EntitlementDecision,
  EntitlementFeature,
  SubscriptionPlan,
  WorkspaceEntitlements,
} from '@/lib/entitlements/types';
import {
  hasMinimumPlan,
  STARTER_MAX_AGREEMENTS,
  STARTER_MAX_AI_IMPORTS,
} from '@/lib/entitlements/plans';
import {
  getEffectivePlan,
  hasActivePaidSubscription,
  requiresPaidSubscription,
} from '@/lib/entitlements/subscription-state';

function allowed(): EntitlementDecision {
  return { allowed: true };
}

function denied(
  requiredPlan: SubscriptionPlan,
  reason: string,
  extra?: Partial<EntitlementDecision>
): EntitlementDecision {
  return { allowed: false, requiredPlan, reason, ...extra };
}

function checkPlan(
  ctx: EntitlementContext,
  requiredPlan: SubscriptionPlan,
  reason: string
): EntitlementDecision {
  if (ctx.pilotBypass) return allowed();

  const effectivePlan = getEffectivePlan(ctx);
  if (hasMinimumPlan(effectivePlan, requiredPlan)) {
    if (requiresPaidSubscription(requiredPlan) && !hasActivePaidSubscription(ctx)) {
      return denied(requiredPlan, 'subscription_inactive');
    }
    return allowed();
  }

  if (
    hasMinimumPlan(ctx.plan, requiredPlan) &&
    requiresPaidSubscription(requiredPlan) &&
    !hasActivePaidSubscription(ctx)
  ) {
    return denied(requiredPlan, 'subscription_inactive');
  }

  return denied(requiredPlan, reason);
}

export function isEntitlementGatingActive(ctx: EntitlementContext): boolean {
  return !ctx.pilotBypass;
}

export function canCreateAgreement(ctx: EntitlementContext): EntitlementDecision {
  if (ctx.pilotBypass) return allowed();
  if (hasMinimumPlan(getEffectivePlan(ctx), 'professional')) return allowed();
  if (ctx.usage.agreementCount < STARTER_MAX_AGREEMENTS) return allowed();
  return denied('professional', 'active_agreement_limit', {
    limit: STARTER_MAX_AGREEMENTS,
    current: ctx.usage.agreementCount,
  });
}

export function canUseAiImport(ctx: EntitlementContext): EntitlementDecision {
  if (ctx.pilotBypass) return allowed();
  if (hasMinimumPlan(getEffectivePlan(ctx), 'professional')) return allowed();
  if (ctx.usage.aiImportCount < STARTER_MAX_AI_IMPORTS) return allowed();
  return denied('professional', 'ai_import_limit', {
    limit: STARTER_MAX_AI_IMPORTS,
    current: ctx.usage.aiImportCount,
  });
}

export function canCreatePaymentLinks(ctx: EntitlementContext): EntitlementDecision {
  return checkPlan(ctx, 'professional', 'payment_links_professional');
}

export function canUseReferralManagement(ctx: EntitlementContext): EntitlementDecision {
  return checkPlan(ctx, 'professional', 'referral_management_professional');
}

export function canUseXeroIntegration(ctx: EntitlementContext): EntitlementDecision {
  return checkPlan(ctx, 'professional', 'xero_integration_professional');
}

export function canInviteTeamMembers(ctx: EntitlementContext): EntitlementDecision {
  return checkPlan(ctx, 'growth', 'team_members_growth');
}

export function canUseApprovalWorkflows(ctx: EntitlementContext): EntitlementDecision {
  // Participant agreements, approvals, and referral links are part of Professional's
  // Referral Management feature. Growth only adds advanced automation on top.
  return checkPlan(ctx, 'professional', 'approval_workflows_professional');
}

export function canUseAdvancedReporting(ctx: EntitlementContext): EntitlementDecision {
  return checkPlan(ctx, 'growth', 'advanced_reporting_growth');
}

export function canUseAutomatedSettlementCoordination(ctx: EntitlementContext): EntitlementDecision {
  return checkPlan(ctx, 'growth', 'settlement_coordination_growth');
}

export function canCreateAdditionalOrganization(ctx: EntitlementContext): EntitlementDecision {
  if (ctx.pilotBypass) return allowed();
  if (ctx.usage.workspaceCount < 1) return allowed();
  if (hasMinimumPlan(getEffectivePlan(ctx), 'enterprise')) return allowed();
  return denied('enterprise', 'multi_organisation_enterprise');
}

export function canUseApiAccess(ctx: EntitlementContext): EntitlementDecision {
  return checkPlan(ctx, 'enterprise', 'api_access_enterprise');
}

export function canUseCustomWorkflows(ctx: EntitlementContext): EntitlementDecision {
  return checkPlan(ctx, 'enterprise', 'custom_workflows_enterprise');
}

export function canUseCustomSettlementRules(ctx: EntitlementContext): EntitlementDecision {
  return checkPlan(ctx, 'enterprise', 'custom_settlement_rules_enterprise');
}

const FEATURE_EVALUATORS: Record<
  EntitlementFeature,
  (ctx: EntitlementContext) => EntitlementDecision
> = {
  create_agreement: canCreateAgreement,
  ai_import: canUseAiImport,
  payment_links: canCreatePaymentLinks,
  referral_management: canUseReferralManagement,
  xero_integration: canUseXeroIntegration,
  team_members: canInviteTeamMembers,
  approval_workflows: canUseApprovalWorkflows,
  advanced_reporting: canUseAdvancedReporting,
  automated_settlement_coordination: canUseAutomatedSettlementCoordination,
  multi_organisation: canCreateAdditionalOrganization,
  api_access: canUseApiAccess,
  custom_workflows: canUseCustomWorkflows,
  custom_settlement_rules: canUseCustomSettlementRules,
};

export function evaluateFeature(
  ctx: EntitlementContext,
  feature: EntitlementFeature
): EntitlementDecision {
  return FEATURE_EVALUATORS[feature](ctx);
}

export function buildWorkspaceEntitlements(ctx: EntitlementContext): WorkspaceEntitlements {
  const features = Object.fromEntries(
    (Object.keys(FEATURE_EVALUATORS) as EntitlementFeature[]).map((key) => [
      key,
      evaluateFeature(ctx, key),
    ])
  ) as Record<EntitlementFeature, EntitlementDecision>;

  return {
    plan: ctx.plan,
    effectivePlan: getEffectivePlan(ctx),
    status: ctx.status,
    hasActivePaidSubscription: hasActivePaidSubscription(ctx),
    stripeCustomerId: ctx.stripeCustomerId,
    stripeSubscriptionId: ctx.stripeSubscriptionId,
    currentPeriodEnd: ctx.currentPeriodEnd?.toISOString() ?? null,
    usage: ctx.usage,
    pilotBypass: ctx.pilotBypass,
    features,
  };
}
