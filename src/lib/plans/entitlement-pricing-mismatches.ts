/**
 * Documented gaps between App_Pricing marketing copy and backend entitlement rules.
 * Do NOT silently change entitlement evaluators to match marketing — product must confirm.
 */

export type EntitlementPricingMismatch = {
  id: string;
  marketingCopy: string;
  backendEntitlement: string;
  notes: string;
};

/** Known mismatches — preserved intentionally until product confirms reconciliation. */
export const ENTITLEMENT_PRICING_MISMATCHES: readonly EntitlementPricingMismatch[] = [
  {
    id: 'automated_settlement_tracking',
    marketingCopy:
      'Professional plan lists "Automated settlement tracking" (App_Pricing).',
    backendEntitlement:
      'automated_settlement_coordination requires Growth (canUseAutomatedSettlementCoordination → growth).',
    notes:
      'Customer-facing catalogue shows automated settlement on Professional; API gates settlement coordination on Growth. Backend rule unchanged pending product decision.',
  },
  {
    id: 'approval_workflows_plan_tier',
    marketingCopy: 'Growth plan lists "Approval workflows".',
    backendEntitlement:
      'approval_workflows requires Professional (canUseApprovalWorkflows → professional).',
    notes:
      'Marketing places approval workflows on Growth; backend grants on Professional. Backend rule unchanged pending product decision.',
  },
  {
    id: 'white_label_documents',
    marketingCopy: 'Growth plan lists "White-label documents".',
    backendEntitlement: 'No dedicated entitlement feature exists in workspace-entitlements.ts.',
    notes: 'Marketing-only capability until a feature flag/entitlement is defined.',
  },
];
