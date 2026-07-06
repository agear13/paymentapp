export enum WorkspaceMode {
  Payments = 'payments',
  Operations = 'operations',
}

export enum WorkspaceFeature {
  Dashboard = 'dashboard',
  Payments = 'payments',
  Invoices = 'invoices',
  Reporting = 'reporting',
  Ledger = 'ledger',
  Exports = 'exports',
  Xero = 'xero',
  Integrations = 'integrations',
  Settings = 'settings',
  Agreements = 'agreements',
  Participants = 'participants',
  Funding = 'funding',
  Settlement = 'settlement',
  Obligations = 'obligations',
  Earnings = 'earnings',
  AgreementIntelligence = 'agreement_intelligence',
  AllocationRules = 'allocation_rules',
  CommissionLinks = 'commission_links',
  Marketing = 'marketing',
}

export type WorkspaceFeatureConfig = {
  mode: WorkspaceMode;
  enabledFeatures: readonly WorkspaceFeature[];
};
