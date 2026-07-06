import { WorkspaceFeature, WorkspaceMode, type WorkspaceFeatureConfig } from './types';

export const PAYMENTS_MODE_FEATURES = [
  WorkspaceFeature.Dashboard,
  WorkspaceFeature.Payments,
  WorkspaceFeature.Invoices,
  WorkspaceFeature.Reporting,
  WorkspaceFeature.Ledger,
  WorkspaceFeature.Exports,
  WorkspaceFeature.Xero,
  WorkspaceFeature.Integrations,
  WorkspaceFeature.Marketing,
  WorkspaceFeature.Settings,
] as const satisfies readonly WorkspaceFeature[];

export const OPERATIONS_MODE_FEATURES = [
  ...PAYMENTS_MODE_FEATURES,
  WorkspaceFeature.Agreements,
  WorkspaceFeature.Participants,
  WorkspaceFeature.Funding,
  WorkspaceFeature.Settlement,
  WorkspaceFeature.Obligations,
  WorkspaceFeature.Earnings,
  WorkspaceFeature.AgreementIntelligence,
  WorkspaceFeature.AllocationRules,
  WorkspaceFeature.CommissionLinks,
] as const satisfies readonly WorkspaceFeature[];

export const WORKSPACE_MODE_FEATURES = {
  [WorkspaceMode.Payments]: PAYMENTS_MODE_FEATURES,
  [WorkspaceMode.Operations]: OPERATIONS_MODE_FEATURES,
} as const satisfies Record<WorkspaceMode, readonly WorkspaceFeature[]>;

/**
 * Temporary workspace feature source. Replace with backend workspace config once
 * workspace modes are persisted.
 */
export const MOCK_WORKSPACE_FEATURE_CONFIG = {
  mode: WorkspaceMode.Operations,
  enabledFeatures: WORKSPACE_MODE_FEATURES[WorkspaceMode.Operations],
} as const satisfies WorkspaceFeatureConfig;

export function getWorkspaceFeatureConfig(
  mode: WorkspaceMode = MOCK_WORKSPACE_FEATURE_CONFIG.mode
): WorkspaceFeatureConfig {
  return {
    mode,
    enabledFeatures: WORKSPACE_MODE_FEATURES[mode],
  };
}
