export type {
  SubscriptionPlan,
  SubscriptionStatus,
  EntitlementFeature,
  EntitlementContext,
  EntitlementDecision,
  WorkspaceEntitlements,
  WorkspaceUsage,
} from '@/lib/entitlements/types';

export {
  PLAN_RANK,
  STARTER_MAX_AGREEMENTS,
  STARTER_MAX_AI_IMPORTS,
  hasMinimumPlan,
  isSubscriptionPlan,
  normalizeSubscriptionPlan,
  requiredPlanLabel,
} from '@/lib/entitlements/plans';

export { requireReferralManagementEntitlement } from '@/lib/entitlements/gate-referral-admin.server';

export {
  getEffectivePlan,
  hasActiveFirstPartyTrial,
  hasActivePaidSubscription,
  hasEntitledPlanAccess,
  isExpiredFirstPartyTrial,
  isPaidFeatureAllowed,
  requiresPaidSubscription,
} from '@/lib/entitlements/subscription-state';

export {
  PROFESSIONAL_TRIAL_DAYS,
  computeProfessionalTrialEndsAt,
  journeyWorkspaceSubscriptionCreate,
} from '@/lib/entitlements/professional-trial';

export {
  canCreateAgreement,
  canUseAiImport,
  canCreatePaymentLinks,
  canUseReferralManagement,
  canUseXeroIntegration,
  canInviteTeamMembers,
  canUseApprovalWorkflows,
  canUseAdvancedReporting,
  canUseAutomatedSettlementCoordination,
  canCreateAdditionalOrganization,
  canUseApiAccess,
  canUseCustomWorkflows,
  canUseCustomSettlementRules,
  evaluateFeature,
  buildWorkspaceEntitlements,
  isEntitlementGatingActive,
} from '@/lib/entitlements/workspace-entitlements';
