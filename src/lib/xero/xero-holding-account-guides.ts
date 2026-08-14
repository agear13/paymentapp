/**
 * Merchant-facing Xero holding-account create guides — UX copy only.
 * Single source for all canonical holding account setup instructions.
 */

import {
  LEGACY_CRYPTO_ASSET_SLOTS,
  SHARED_DIGITAL_HOLDING,
  STRIPE_HOLDING,
  WISE_HOLDING,
} from '@/lib/accounting/settlement-account-config';

/** Shared copy — holding payment is automated; bank-side clearing is not. */
export const HOLDING_ACCOUNT_BANK_SETTLEMENT_NOTE =
  'Bank settlement and clearing the holding balance are not posted automatically by Provvy — use your normal Xero reconciliation workflow (or ask your accountant).';

export type XeroGuideFieldClassification =
  | 'required_for_provvvy'
  | 'recommended'
  | 'do_not_enable'
  | 'confirm_with_accountant';

export type XeroCreateAccountField = {
  label: string;
  value: string;
  classification: XeroGuideFieldClassification;
};

export type XeroCreateAccountInXeroGuide = {
  title: string;
  whenYouNeedThis: string;
  steps: readonly string[];
  createFields: readonly XeroCreateAccountField[];
  closingSteps: readonly string[];
  whySettings: {
    title: string;
    body: string;
    taxClarification?: string;
  };
  accountingNote: {
    title: string;
    body: string;
  };
  afterCreate: string;
};

export const XERO_GUIDE_FIELD_CLASSIFICATION_LABELS: Record<
  XeroGuideFieldClassification,
  string
> = {
  required_for_provvvy: 'Required for Provvy',
  recommended: 'Recommended',
  do_not_enable: 'Do not enable',
  confirm_with_accountant: 'Confirm with accountant',
};

export const HOLDING_ACCOUNT_ACCOUNTANT_DISCLAIMER =
  "These are Provvy's recommended Xero configuration settings. GST/BAS treatment can depend on your accounting setup. Confirm tax treatment with your accountant if you're unsure.";

/** Opens Xero Chart of accounts (merchant creates holding accounts here). */
export const XERO_CHART_OF_ACCOUNTS_URL =
  'https://go.xero.com/GeneralLedger/ChartOfAccounts.aspx';

const STANDARD_CREATE_STEPS = [
  'Open Xero and go to Accounting → Chart of accounts.',
  'Click Add Account.',
  'Create the account with these settings:',
] as const;

const STANDARD_CLOSING_STEPS = [
  'Save the account.',
  'Return to Provvy and select or link the account from the list below.',
] as const;

const STANDARD_AFTER_CREATE =
  'After the account appears in Xero, click "Use recommended account" or pick it from the list below.';

function standardCreateFields(
  accountName: string,
  suggestedCode: string
): XeroCreateAccountField[] {
  return [
    { label: 'Name', value: accountName, classification: 'recommended' },
    {
      label: 'Account type',
      value: 'Current Asset',
      classification: 'required_for_provvvy',
    },
    {
      label: 'Code',
      value: `${suggestedCode} if available`,
      classification: 'recommended',
    },
    {
      label: 'Tax',
      value: 'BAS Excluded — recommended; confirm with your accountant',
      classification: 'confirm_with_accountant',
    },
    {
      label: 'Enable payments to this account',
      value: 'Yes',
      classification: 'required_for_provvvy',
    },
    {
      label: 'Show on Dashboard Watchlist',
      value: 'No',
      classification: 'do_not_enable',
    },
    {
      label: 'Show in Expense Claims',
      value: 'No',
      classification: 'do_not_enable',
    },
  ];
}

const STANDARD_TAX_CLARIFICATION =
  'BAS Excluded is the recommended Provvy configuration for holding accounts — your accountant should confirm it fits your chart. It applies to the holding account itself, not your customer sales; revenue and GST still follow your normal invoice settings.';

type HoldingAccountGuideDefinition = {
  accountName: string;
  suggestedCode: string;
  whenYouNeedThis: string;
  whyBody: string;
  accountingNoteBody: string;
  taxClarification?: string;
};

function buildHoldingAccountCreateGuide(
  definition: HoldingAccountGuideDefinition
): XeroCreateAccountInXeroGuide {
  return {
    title: 'How to create this in Xero',
    whenYouNeedThis: definition.whenYouNeedThis,
    steps: STANDARD_CREATE_STEPS,
    createFields: standardCreateFields(definition.accountName, definition.suggestedCode),
    closingSteps: STANDARD_CLOSING_STEPS,
    whySettings: {
      title: 'Why these settings?',
      body: definition.whyBody,
      taxClarification: definition.taxClarification ?? STANDARD_TAX_CLARIFICATION,
    },
    accountingNote: {
      title: 'Accounting / reconciliation note',
      body: `${definition.accountingNoteBody} ${HOLDING_ACCOUNT_ACCOUNTANT_DISCLAIMER}`,
    },
    afterCreate: STANDARD_AFTER_CREATE,
  };
}

const HOLDING_ACCOUNT_GUIDE_DEFINITIONS: Record<string, HoldingAccountGuideDefinition> = {
  [STRIPE_HOLDING.accountName]: {
    accountName: STRIPE_HOLDING.accountName,
    suggestedCode: STRIPE_HOLDING.suggestedCode,
    whenYouNeedThis: 'Link this account when customers can pay you by card through Stripe.',
    whyBody:
      'Stripe Holding is a temporary holding account for card payments. When a customer pays, Provvy records the payment against this account in Xero. ' +
      HOLDING_ACCOUNT_BANK_SETTLEMENT_NOTE,
    accountingNoteBody:
      'Provvy records the customer payment in Xero against Stripe Holding. Clearing that balance when Stripe pays out to your bank is handled in your normal Xero workflow — Provvy does not post the bank deposit for you.',
  },
  [WISE_HOLDING.accountName]: {
    accountName: WISE_HOLDING.accountName,
    suggestedCode: WISE_HOLDING.suggestedCode,
    whenYouNeedThis:
      'Link this account when customers can pay you by Wise transfer or manual bank transfer.',
    whyBody:
      'Wise Holding is where Provvy records Wise and manual bank transfer payments in Xero when customers pay. ' +
      HOLDING_ACCOUNT_BANK_SETTLEMENT_NOTE,
    accountingNoteBody:
      'Provvy records the customer payment in Xero against Wise Holding. When the deposit appears in your bank account, clearing the holding balance is handled in your normal Xero workflow — Provvy does not post the bank settlement for you.',
  },
  [SHARED_DIGITAL_HOLDING.accountName]: {
    accountName: SHARED_DIGITAL_HOLDING.accountName,
    suggestedCode: SHARED_DIGITAL_HOLDING.suggestedCode,
    whenYouNeedThis:
      'Link this account when you accept crypto or stablecoin payments and use one shared holding account for all digital assets.',
    whyBody:
      'Digital Asset Holding is where Provvy records crypto payments in Xero when customers pay. With the shared setup, multiple digital assets (such as HBAR, USDC, USDT, and AUDD) can use this same account. ' +
      'Wallet or exchange settlement and clearing this balance are not posted automatically by Provvy — use your normal Xero reconciliation workflow (or ask your accountant).',
    accountingNoteBody:
      'Provvy records each crypto payment in Xero against Digital Asset Holding. Because several assets may share this account, asset-level reconciliation and tax treatment may need your accountant\'s review. Provvy does not post wallet or bank settlement into Xero for you.',
    taxClarification:
      'BAS Excluded is the recommended Provvy configuration for holding accounts — your accountant should confirm it fits your chart and crypto setup. It applies to the holding account itself, not your customer sales.',
  },
  ...Object.fromEntries(
    LEGACY_CRYPTO_ASSET_SLOTS.map((slot) => [
      `${slot.asset} Holding`,
      {
        accountName: `${slot.asset} Holding`,
        suggestedCode: slot.suggestedCode,
        whenYouNeedThis: `Link this account when you accept ${slot.asset} payments and use separate holding accounts for each digital asset.`,
        whyBody:
          `Provvy records ${slot.asset} payments against this holding account in Xero when customers pay. ` +
          'Wallet or exchange settlement and clearing this balance are not posted automatically by Provvy — use your normal Xero reconciliation workflow (or ask your accountant).',
        accountingNoteBody:
          `Provvy records each ${slot.asset} payment in Xero against ${slot.asset} Holding. Clearing the balance when funds move to your wallet or bank is handled in your normal Xero workflow — Provvy does not post that settlement for you.`,
        taxClarification:
          slot.asset === 'AUDD'
            ? 'BAS Excluded is the recommended Provvy configuration for holding accounts — your accountant should confirm it fits your chart, especially for AUDD and AUD-matched payments.'
            : STANDARD_TAX_CLARIFICATION,
      } satisfies HoldingAccountGuideDefinition,
    ])
  ),
};

function guidesFromDefinitions(): Record<string, XeroCreateAccountInXeroGuide> {
  const guides: Record<string, XeroCreateAccountInXeroGuide> = {};
  for (const [accountName, definition] of Object.entries(HOLDING_ACCOUNT_GUIDE_DEFINITIONS)) {
    guides[accountName] = buildHoldingAccountCreateGuide(definition);
  }
  return guides;
}

export const HOLDING_ACCOUNT_CREATE_IN_XERO_GUIDES = guidesFromDefinitions();

/** @deprecated Use HOLDING_ACCOUNT_CREATE_IN_XERO_GUIDES['Stripe Holding'] */
export const STRIPE_HOLDING_CREATE_IN_XERO_GUIDE =
  HOLDING_ACCOUNT_CREATE_IN_XERO_GUIDES[STRIPE_HOLDING.accountName]!;

/** Generic fallback when account name is not a known holding account. */
export const XERO_CREATE_ACCOUNT_IN_XERO_GUIDE: Pick<
  XeroCreateAccountInXeroGuide,
  'title' | 'steps' | 'afterCreate'
> & {
  steps: readonly string[];
  afterCreate: string;
} = {
  title: 'How to create this in Xero',
  steps: [
    'Open Xero and go to Accounting → Chart of accounts.',
    'Click Add Account.',
    `Enter the account name and type shown above (use code ${'{code}'} if Xero asks for one).`,
    'Save the account, return here, and choose it from the list.',
  ],
  afterCreate: STANDARD_AFTER_CREATE,
};

export const CANONICAL_HOLDING_ACCOUNT_NAMES = [
  STRIPE_HOLDING.accountName,
  WISE_HOLDING.accountName,
  SHARED_DIGITAL_HOLDING.accountName,
  ...LEGACY_CRYPTO_ASSET_SLOTS.map((slot) => `${slot.asset} Holding`),
] as const;

/** Pick merchant-facing Xero account creation guide for a payment holding account. */
export function resolveCreateAccountInXeroGuide(input: {
  paymentRail?: string;
  accountName: string;
}): XeroCreateAccountInXeroGuide | typeof XERO_CREATE_ACCOUNT_IN_XERO_GUIDE {
  const trimmed = input.accountName.trim();
  const guide = HOLDING_ACCOUNT_CREATE_IN_XERO_GUIDES[trimmed];
  if (guide) {
    return guide;
  }

  return XERO_CREATE_ACCOUNT_IN_XERO_GUIDE;
}

export function isDetailedHoldingAccountGuide(
  guide: XeroCreateAccountInXeroGuide | typeof XERO_CREATE_ACCOUNT_IN_XERO_GUIDE
): guide is XeroCreateAccountInXeroGuide {
  return 'createFields' in guide && Array.isArray(guide.createFields);
}
