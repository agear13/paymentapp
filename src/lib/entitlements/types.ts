import type { DashboardProductProfile } from '@/lib/auth/admin-shared';

export type SubscriptionPlan = 'starter' | 'professional' | 'growth' | 'enterprise';

export type SubscriptionStatus = 'inactive' | 'active' | 'trialing' | 'past_due' | 'canceled';

export type EntitlementFeature =
  | 'create_agreement'
  | 'ai_import'
  | 'payment_links'
  | 'referral_management'
  | 'xero_integration'
  | 'team_members'
  | 'approval_workflows'
  | 'advanced_reporting'
  | 'automated_settlement_coordination'
  | 'multi_organisation'
  | 'api_access'
  | 'custom_workflows'
  | 'custom_settlement_rules';

export type WorkspaceUsage = {
  agreementCount: number;
  aiImportCount: number;
  teamMemberCount: number;
  workspaceCount: number;
};

export type EntitlementContext = {
  organizationId: string;
  userId: string;
  productProfile: DashboardProductProfile;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
  usage: WorkspaceUsage;
  /** When true, all entitlement checks pass (Rabbit Hole / Strait pilots). */
  pilotBypass: boolean;
};

export type EntitlementDecision = {
  allowed: boolean;
  requiredPlan?: SubscriptionPlan;
  reason?: string;
  limit?: number;
  current?: number;
};

export type WorkspaceEntitlements = {
  plan: SubscriptionPlan;
  effectivePlan: SubscriptionPlan;
  status: SubscriptionStatus;
  hasActivePaidSubscription: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  usage: WorkspaceUsage;
  pilotBypass: boolean;
  features: Record<EntitlementFeature, EntitlementDecision>;
};
