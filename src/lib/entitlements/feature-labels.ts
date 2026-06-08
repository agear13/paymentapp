import type { EntitlementFeature, SubscriptionPlan } from '@/lib/entitlements/types';
import { requiredPlanLabel } from '@/lib/entitlements/plans';

export const FEATURE_DISPLAY_NAMES: Record<EntitlementFeature, string> = {
  create_agreement: 'Agreements',
  ai_import: 'AI Agreement Import',
  payment_links: 'Payment Links',
  referral_management: 'Referral & Affiliate Management',
  xero_integration: 'Xero Integration',
  team_members: 'Multi-User Collaboration',
  approval_workflows: 'Approval Workflows',
  advanced_reporting: 'Advanced Reporting',
  automated_settlement_coordination: 'Automated Settlement Coordination',
  multi_organisation: 'Multiple Organisations',
  api_access: 'API Access',
  custom_workflows: 'Custom Workflows',
  custom_settlement_rules: 'Custom Settlement Rules',
};

export function upgradeHeadline(feature: EntitlementFeature, atLimit?: boolean): string {
  if (atLimit && feature === 'create_agreement') return 'Agreement limit reached';
  if (atLimit && feature === 'ai_import') return 'AI import limit reached';
  return `${FEATURE_DISPLAY_NAMES[feature]} requires an upgrade`;
}

export function upgradeBody(
  feature: EntitlementFeature,
  requiredPlan: SubscriptionPlan,
  atLimit?: boolean
): string {
  switch (feature) {
    case 'create_agreement':
      return atLimit
        ? 'Starter includes up to 3 active agreements. Upgrade to Professional for unlimited agreements.'
        : `Upgrade to ${requiredPlanLabel(requiredPlan)} to create more agreements.`;
    case 'ai_import':
      return atLimit
        ? 'Starter includes 3 AI-powered agreement imports. Upgrade to Professional for unlimited imports.'
        : `Upgrade to ${requiredPlanLabel(requiredPlan)} for unlimited AI imports.`;
    case 'payment_links':
      return 'Payment Links are available on Professional.';
    case 'referral_management':
      return 'Referral & Affiliate Management is available on Professional.';
    case 'xero_integration':
      return 'Xero Integration is available on Professional.';
    case 'team_members':
      return 'Multi-user collaboration is available on Growth.';
    case 'approval_workflows':
      return 'Approval Workflows are available on Growth.';
    case 'advanced_reporting':
      return 'Advanced Reporting is available on Growth.';
    case 'automated_settlement_coordination':
      return 'Automated Settlement Coordination is available on Growth.';
    case 'multi_organisation':
      return 'Multiple Organisations is available on Enterprise.';
    case 'api_access':
      return 'API Access is available on Enterprise.';
    case 'custom_workflows':
      return 'Custom Workflows are available on Enterprise.';
    case 'custom_settlement_rules':
      return 'Custom Settlement Rules are available on Enterprise.';
    default:
      return `Upgrade to ${requiredPlanLabel(requiredPlan)} to unlock ${FEATURE_DISPLAY_NAMES[feature]}.`;
  }
}

export function upgradeCta(requiredPlan: SubscriptionPlan): string {
  if (requiredPlan === 'professional') return 'Upgrade to Professional';
  if (requiredPlan === 'growth') return 'Upgrade to Growth';
  if (requiredPlan === 'enterprise') return 'Contact Sales';
  return 'Upgrade Plan';
}
