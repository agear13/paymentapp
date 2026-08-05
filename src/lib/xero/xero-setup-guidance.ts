/**
 * Plain-English guidance for Xero setup — UX copy only, no business logic.
 */

import type { XeroMappingField } from '@/lib/accounting/recommended-accounting-config';

export const XERO_SETUP_PAGE = {
  title: 'Set up Xero',
  subtitle:
    'Connect Xero, confirm where invoices and payments are recorded, then create your first invoice.',
} as const;

export const XERO_CONNECT_MODAL = {
  title: 'Connect Xero',
  bodyIntro: "You'll sign in on Xero's website, then return here automatically.",
  steps: [
    'Sign into Xero',
    'Select the business you want to connect',
    'Approve access',
  ],
  returnNote: "You'll come back to Provvy when you're finished.",
  estimatedTime: '30–60 seconds',
  continueLabel: 'Continue to Xero',
  cancelLabel: 'Cancel',
} as const;

export const CLEARING_ACCOUNTS_EXPLANATION = {
  body: 'Provvy records each payment in Xero first, then matches it when the money reaches your bank.',
  reassurance: 'Provvy only adds new accounts in Xero if you ask — nothing is deleted.',
} as const;

export const XERO_INVOICE_READINESS_COPY = {
  heroQuestion: 'Ready to create invoices?',
  createInvoiceCta: 'Create your first invoice →',
  checking: 'Checking…',
} as const;

export type XeroFieldCustomerCopy = {
  label: string;
  helper: string;
  learnMore?: string;
};

/** Customer-facing label + what/why helper for each mapping field. */
export const XERO_FIELD_CUSTOMER_COPY: Partial<Record<XeroMappingField, XeroFieldCustomerCopy>> = {
  xero_revenue_account_id: {
    label: 'Where your sales are recorded',
    helper:
      'Provvy posts customer payments to this Xero account when an invoice is paid.',
    learnMore: 'In Xero this is usually called Sales or Revenue.',
  },
  xero_receivable_account_id: {
    label: 'Where unpaid invoices are tracked',
    helper:
      'Provvy creates each invoice here until your customer pays.',
    learnMore: 'In Xero this is often called Accounts Receivable.',
  },
  xero_stripe_clearing_account_id: {
    label: 'Where card payments land (Stripe)',
    helper:
      'Provvy records Stripe payments here before they reach your bank account.',
    learnMore:
      'A holding account is a temporary place in Xero for money that is on its way to you.',
  },
  xero_wise_clearing_account_id: {
    label: 'Where bank transfers land',
    helper:
      'Provvy records bank transfer and Wise payments here when customers pay that way.',
    learnMore:
      'A holding account is a temporary place in Xero for money that is on its way to you.',
  },
  xero_fee_expense_account_id: {
    label: 'Card fees (optional)',
    helper:
      'Provvy can record Stripe processing fees here. You can skip this if you track fees another way.',
    learnMore: 'In Xero this is usually a Bank Fees or Merchant Fees expense account.',
  },
  xero_hbar_clearing_account_id: {
    label: 'Where HBAR payments land',
    helper: 'Provvy records HBAR payments here before they are converted or settled.',
    learnMore:
      'A holding account is a temporary place in Xero for money that is on its way to you.',
  },
  xero_usdc_clearing_account_id: {
    label: 'Where USDC payments land',
    helper: 'Provvy records USDC payments here before they are converted or settled.',
    learnMore:
      'A holding account is a temporary place in Xero for money that is on its way to you.',
  },
  xero_usdt_clearing_account_id: {
    label: 'Where USDT payments land',
    helper: 'Provvy records USDT payments here before they are converted or settled.',
    learnMore:
      'A holding account is a temporary place in Xero for money that is on its way to you.',
  },
  xero_audd_clearing_account_id: {
    label: 'Where AUDD payments land',
    helper: 'Provvy records AUDD payments here before they are converted or settled.',
    learnMore:
      'A holding account is a temporary place in Xero for money that is on its way to you.',
  },
};

/** Short field labels — legacy fallback when customer copy is unavailable. */
export const XERO_MAPPING_FIELD_LABELS: Partial<Record<XeroMappingField, string>> = {
  xero_revenue_account_id: 'Where your sales are recorded',
  xero_receivable_account_id: 'Where unpaid invoices are tracked',
  xero_fee_expense_account_id: 'Card fees (optional)',
  xero_stripe_clearing_account_id: 'Where card payments land (Stripe)',
  xero_hbar_clearing_account_id: 'Where HBAR payments land',
  xero_usdc_clearing_account_id: 'Where USDC payments land',
  xero_usdt_clearing_account_id: 'Where USDT payments land',
  xero_audd_clearing_account_id: 'Where AUDD payments land',
  xero_wise_clearing_account_id: 'Where bank transfers land',
};

export function getXeroFieldCustomerCopy(field: XeroMappingField): XeroFieldCustomerCopy | undefined {
  return XERO_FIELD_CUSTOMER_COPY[field];
}

export const XERO_ACCOUNT_SECTION_COPY = {
  invoiceIntro:
    'Provvy creates invoices in Xero using these accounts. Both are required before you can invoice.',
  paymentIntro:
    'Provvy records customer payments in Xero using these accounts. Required accounts depend on how customers can pay you.',
  invoiceSummaryDone: 'Where invoices go — Done',
  paymentSummaryDone: 'Where payments go — Done',
  invoiceSummaryRequired: (count: number) =>
    count === 1 ? 'Where invoices go — 1 required' : `Where invoices go — ${count} required`,
  paymentSummaryRequired: (count: number) =>
    count === 1 ? 'Where payments go — 1 required' : `Where payments go — ${count} required`,
  paymentSummaryWithOptional: (optionalCount: number) =>
    optionalCount === 1
      ? 'Where payments go — Done · 1 optional'
      : `Where payments go — Done · ${optionalCount} optional`,
  useSuggestedInvoiceAccounts: "Use Provvy's suggestions",
  changeInvoiceAccounts: 'Change invoice accounts',
  saveChoices: 'Save choices',
  selectPlaceholder: 'Choose a Xero account',
  learnMore: 'Learn more',
} as const;

export const XERO_OAUTH_SUCCESS = {
  title: 'Xero is connected',
  body: 'Provvy loaded your Xero accounts. Nothing has been saved yet — please confirm your choices below.',
  nextStep: 'Pick the accounts Provvy should use, then save your choices.',
  continueLabel: 'Review accounts',
} as const;

export const XERO_CONNECTION_COPY = {
  connectedHeading: 'Xero connection',
  disconnectedHeading: 'Connect Xero',
  connectButton: 'Connect Xero',
  reconnectButton: 'Reconnect to Xero',
  businessLabel: 'Which Xero business?',
  businessHelper: 'Provvy will send invoices and payments to this business.',
  disconnectedHelper: 'Connect Xero so Provvy can create invoices and record payments for you.',
  connectedHelper:
    'Your Xero connection is active. Choose your business below if you have more than one.',
} as const;

export const XERO_SETUP_PROGRESS_COPY = {
  title: 'Setup checklist',
  loading: 'Loading setup progress…',
  percentComplete: (percent: number) => `${percent}% complete`,
} as const;

export const QUEUE_GUIDANCE = {
  title: 'Payments syncing to Xero',
  intro: (count: number) =>
    `Provvy found ${count} payment${count === 1 ? '' : 's'} to send to Xero after you connected.`,
  context:
    'This is normal when you connect Xero. Provvy syncs these automatically — you can still create invoices while you wait.',
  empty: 'No payments are waiting to sync. New payments will sync automatically.',
  queueMissedLabel: 'Find payments I may have missed',
  processQueueLabel: 'Sync payments to Xero',
  advancedOptions: 'More options',
  paymentLabel: (index: number) => `Payment ${index + 1}`,
} as const;

export type SyncStatusKey = 'PENDING' | 'RETRYING' | 'SUCCESS' | 'FAILED';

export const SYNC_STATUS_GUIDANCE: Record<
  SyncStatusKey,
  { label: string; explanation: string }
> = {
  PENDING: {
    label: 'Pending',
    explanation: 'Provvy will send this to Xero shortly. You can still create invoices.',
  },
  RETRYING: {
    label: 'Retrying',
    explanation: 'Provvy is trying again automatically.',
  },
  SUCCESS: {
    label: 'Synced',
    explanation: 'This payment is now in Xero.',
  },
  FAILED: {
    label: 'Failed',
    explanation: "Provvy couldn't match this payment to a Xero invoice yet.",
  },
};

export type XeroSetupStepId =
  | 'connected'
  | 'business_selected'
  | 'mappings_reviewed'
  | 'historical_processed';

export type XeroSetupStep = {
  id: XeroSetupStepId;
  label: string;
  complete: boolean;
};

export type XeroSetupProgressInput = {
  connected: boolean;
  tenantId?: string | null;
  revenueMapped: boolean;
  receivableMapped: boolean;
  pendingPaymentCount: number;
};

export function computeXeroSetupSteps(input: XeroSetupProgressInput): XeroSetupStep[] {
  const hasTenant = Boolean(input.tenantId?.trim());
  const mappingsComplete = input.revenueMapped && input.receivableMapped;
  const queueComplete = input.pendingPaymentCount === 0;

  return [
    { id: 'connected', label: 'Xero connected', complete: input.connected },
    {
      id: 'business_selected',
      label: 'Business chosen',
      complete: input.connected && hasTenant,
    },
    { id: 'mappings_reviewed', label: 'Invoice accounts confirmed', complete: mappingsComplete },
    {
      id: 'historical_processed',
      label: 'Earlier payments synced',
      complete: queueComplete && input.connected,
    },
  ];
}

export function xeroSetupProgressPercent(steps: XeroSetupStep[]): number {
  if (steps.length === 0) return 0;
  const complete = steps.filter((s) => s.complete).length;
  return Math.round((complete / steps.length) * 100);
}

export type MerchantPaymentRails = {
  stripeEnabled: boolean;
  wiseEnabled: boolean;
  stablecoinSettlementsEnabled: boolean;
  /** Manual bank invoices settle via Wise Holding in Xero. Defaults true when omitted. */
  manualBankEnabled?: boolean;
};

export const XERO_CREATE_INVOICE_GATE_COPY = {
  title: 'Finish Xero setup to create invoices',
  body: 'Complete the required sections on your Xero setup page — the checklist at the top shows what is left.',
  cta: 'Go to Xero setup',
} as const;
