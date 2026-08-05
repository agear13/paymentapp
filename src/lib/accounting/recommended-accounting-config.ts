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
  'Provvy records the payment here first, then matches it when the money reaches your bank.';

export const ADVANCED_SETTLEMENT_SECTION_COPY =
  'Provvy records crypto payments in Xero first, then matches them when funds settle. Your accountant can adjust these later if needed.';

export const RECOMMENDED_SETUP_BANNER = {
  title: 'Suggested setup',
  description:
    'Provvy can add separate accounts in Xero for each way customers pay you. This makes it easier to track payments.',
  applyButtonLabel: "Use Provvy's suggestions",
  createButtonLabel: 'Add payment accounts in Xero',
};

/** Clearing accounts — add future rails (Wise, Circle, PayTo, etc.) here. */
export const RECOMMENDED_CLEARING_ACCOUNTS: readonly RecommendedClearingAccountConfig[] = [
  {
    rail: 'Stripe',
    accountName: 'Stripe Holding',
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
    summaryLabel: 'Sales',
    label: 'Where your sales are recorded',
    description: 'Provvy posts customer payments to this Xero account when an invoice is paid.',
    preferredNames: ['Sales', 'Revenue', 'Income'],
    preferredCodes: ['200'],
    preferredAccountTypes: ['SALES', 'REVENUE'],
  },
  {
    mappingField: 'xero_receivable_account_id',
    summaryLabel: 'Unpaid invoices',
    label: 'Where unpaid invoices are tracked',
    description: 'Provvy creates each invoice here until your customer pays.',
    preferredNames: ['Accounts Receivable', 'Trade Debtors', 'Debtors'],
    preferredCodes: ['610', '110', '1200'],
    preferredAccountTypes: ['CURRENT', 'CURRLIAB'],
  },
  {
    mappingField: 'xero_fee_expense_account_id',
    summaryLabel: 'Card fees',
    label: 'Card fees (optional)',
    description: 'Provvy can record Stripe processing fees here if you want them tracked separately.',
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
