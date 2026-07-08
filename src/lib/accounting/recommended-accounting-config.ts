/**
 * Recommended Xero accounting mappings — single source of truth for clearing accounts
 * and standard field defaults. Extend this config when adding new payment rails.
 */

export type XeroMappingField =
  | 'xero_revenue_account_id'
  | 'xero_receivable_account_id'
  | 'xero_stripe_clearing_account_id'
  | 'xero_hbar_clearing_account_id'
  | 'xero_usdc_clearing_account_id'
  | 'xero_usdt_clearing_account_id'
  | 'xero_audd_clearing_account_id'
  | 'xero_wise_clearing_account_id'
  | 'xero_fee_expense_account_id';

export type RecommendedXeroAccountType = 'CURRENT';

export type RecommendedClearingAccountConfig = {
  /** Short rail identifier shown in summaries (e.g. "Stripe", "USDC"). */
  rail: string;
  /** Exact Xero account name to match or create. */
  accountName: string;
  accountType: RecommendedXeroAccountType;
  xeroClass: 'ASSET';
  mappingField: XeroMappingField;
  /** Preferred chart code when creating the account in Xero. */
  suggestedCode: string;
  description: string;
  /** Mapping summary label (left side of "→"). */
  summaryLabel: string;
  /** Dropdown label; falls back to accountName when omitted. */
  uiLabel?: string;
  /** Helper text under the dropdown label. */
  helperText?: string;
  /** Shown only when Hedera / stablecoin rail is configured. */
  requiresStablecoinRail?: boolean;
  /** Account types preferred when sorting dropdown options. */
  preferredAccountTypes?: readonly string[];
};

export type RecommendedStandardMappingConfig = {
  mappingField: XeroMappingField;
  summaryLabel: string;
  label: string;
  description: string;
  preferredNames: readonly string[];
  preferredCodes: readonly string[];
  preferredAccountTypes: readonly string[];
};

export const CLEARING_ACCOUNT_HELPER_TEXT =
  'Temporary clearing account used until funds are settled or converted.';

export const ADVANCED_SETTLEMENT_SECTION_COPY =
  'Digital asset payments are first recorded in temporary clearing accounts before settlement into your bank account. These defaults follow accounting best practice and can be customised by your accountant if required.';

export const RECOMMENDED_SETUP_BANNER = {
  title: 'Recommended Setup',
  description:
    'Provvypay recommends using separate clearing accounts for each payment rail. This makes reconciliation significantly easier and follows accounting best practice.',
  applyButtonLabel: 'Apply Recommended Mapping',
  createButtonLabel: 'Create Recommended Clearing Accounts',
};

/** Clearing accounts — add future rails (Wise, Circle, PayTo, etc.) here. */
export const RECOMMENDED_CLEARING_ACCOUNTS: readonly RecommendedClearingAccountConfig[] = [
  {
    rail: 'Stripe',
    accountName: 'Stripe Clearing',
    accountType: 'CURRENT',
    xeroClass: 'ASSET',
    mappingField: 'xero_stripe_clearing_account_id',
    suggestedCode: '1050',
    description: 'Temporary holding account for Stripe settlements.',
    summaryLabel: 'Stripe',
    preferredAccountTypes: ['BANK', 'CURRENT', 'CURRLIAB'],
  },
  {
    rail: 'HBAR',
    accountName: 'HBAR Clearing',
    accountType: 'CURRENT',
    xeroClass: 'ASSET',
    mappingField: 'xero_hbar_clearing_account_id',
    suggestedCode: '1051',
    description: 'Temporary holding account for HBAR settlements.',
    summaryLabel: 'HBAR',
    uiLabel: 'HBAR (Hedera)',
    helperText: CLEARING_ACCOUNT_HELPER_TEXT,
    requiresStablecoinRail: true,
    preferredAccountTypes: ['BANK', 'CURRENT', 'CURRLIAB'],
  },
  {
    rail: 'USDC',
    accountName: 'USDC Clearing',
    accountType: 'CURRENT',
    xeroClass: 'ASSET',
    mappingField: 'xero_usdc_clearing_account_id',
    suggestedCode: '1052',
    description: 'Temporary holding account for USDC settlements.',
    summaryLabel: 'USDC',
    uiLabel: 'USDC (USD Stablecoin)',
    helperText: CLEARING_ACCOUNT_HELPER_TEXT,
    requiresStablecoinRail: true,
    preferredAccountTypes: ['BANK', 'CURRENT', 'CURRLIAB'],
  },
  {
    rail: 'USDT',
    accountName: 'USDT Clearing',
    accountType: 'CURRENT',
    xeroClass: 'ASSET',
    mappingField: 'xero_usdt_clearing_account_id',
    suggestedCode: '1053',
    description: 'Temporary holding account for USDT settlements.',
    summaryLabel: 'USDT',
    uiLabel: 'USDT (USD Stablecoin)',
    helperText: CLEARING_ACCOUNT_HELPER_TEXT,
    requiresStablecoinRail: true,
    preferredAccountTypes: ['BANK', 'CURRENT', 'CURRLIAB'],
  },
  {
    rail: 'AUDD',
    accountName: 'AUDD Clearing',
    accountType: 'CURRENT',
    xeroClass: 'ASSET',
    mappingField: 'xero_audd_clearing_account_id',
    suggestedCode: '1054',
    description: 'Temporary holding account for AUDD settlements.',
    summaryLabel: 'AUDD',
    uiLabel: 'AUDD (Australian Dollar Stablecoin)',
    helperText: CLEARING_ACCOUNT_HELPER_TEXT,
    requiresStablecoinRail: true,
    preferredAccountTypes: ['BANK', 'CURRENT', 'CURRLIAB'],
  },
  // Future rails — uncomment and configure when ready:
  // {
  //   rail: 'Wise',
  //   accountName: 'Wise Clearing',
  //   accountType: 'CURRENT',
  //   xeroClass: 'ASSET',
  //   mappingField: 'xero_wise_clearing_account_id',
  //   suggestedCode: '1055',
  //   description: 'Temporary holding account for Wise settlements.',
  //   summaryLabel: 'Wise',
  //   preferredAccountTypes: ['BANK', 'CURRENT', 'CURRLIAB'],
  // },
];

export const RECOMMENDED_STANDARD_MAPPINGS: readonly RecommendedStandardMappingConfig[] = [
  {
    mappingField: 'xero_revenue_account_id',
    summaryLabel: 'Revenue',
    label: 'Revenue Account',
    description: 'Sales revenue from invoices',
    preferredNames: ['Sales', 'Revenue', 'Income'],
    preferredCodes: ['200'],
    preferredAccountTypes: ['SALES', 'REVENUE'],
  },
  {
    mappingField: 'xero_receivable_account_id',
    summaryLabel: 'Receivables',
    label: 'Accounts Receivable',
    description: 'Customer invoices pending payment',
    preferredNames: ['Accounts Receivable', 'Trade Debtors', 'Debtors'],
    preferredCodes: ['610', '110', '1200'],
    preferredAccountTypes: ['CURRENT', 'CURRLIAB'],
  },
  {
    mappingField: 'xero_fee_expense_account_id',
    summaryLabel: 'Fees',
    label: 'Processor Fee Expense',
    description: 'Payment processing fees',
    preferredNames: ['Bank Fees', 'Merchant Fees', 'Payment Processing Fees', 'Stripe Fees'],
    preferredCodes: ['404', '6100'],
    preferredAccountTypes: ['EXPENSE', 'OVERHEADS'],
  },
];

export function getClearingAccountsForUi(stablecoinSettlementsEnabled: boolean) {
  return RECOMMENDED_CLEARING_ACCOUNTS.filter(
    (config) => !config.requiresStablecoinRail || stablecoinSettlementsEnabled
  );
}

export function getSummaryClearingAccounts(stablecoinSettlementsEnabled: boolean) {
  return getClearingAccountsForUi(stablecoinSettlementsEnabled);
}

export function getClearingConfigByMappingField(
  field: XeroMappingField
): RecommendedClearingAccountConfig | undefined {
  return RECOMMENDED_CLEARING_ACCOUNTS.find((config) => config.mappingField === field);
}
