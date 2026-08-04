/**
 * Plain-English guidance for Xero setup — UX copy only, no business logic.
 */

import type { XeroMappingField } from '@/lib/accounting/recommended-accounting-config';

export const XERO_CONNECT_MODAL = {
  title: 'Connect your Xero account',
  bodyIntro: 'Provvy will securely redirect you to Xero.',
  steps: [
    'Sign into Xero',
    'Select the business you want to connect',
    'Approve access',
  ],
  returnNote: "You'll automatically return to Provvy when finished.",
  estimatedTime: '30–60 seconds',
  continueLabel: 'Continue to Xero',
  cancelLabel: 'Cancel',
} as const;

export const XERO_OAUTH_SUCCESS = {
  title: 'Xero Connected',
  body: 'Your business has been successfully connected.',
  nextStep:
    "Next we'll make sure invoices and payments are mapped correctly inside Xero. This only takes a minute.",
  continueLabel: 'Continue Setup',
} as const;

/** Friendly labels for mapping summary (left side of arrow). */
export const MAPPING_SUMMARY_FRIENDLY_LABELS: Partial<Record<XeroMappingField, string>> = {
  xero_revenue_account_id: 'Invoice Revenue',
  xero_receivable_account_id: 'Customer Invoices',
  xero_fee_expense_account_id: 'Processing Fees',
  xero_stripe_clearing_account_id: 'Stripe Payments',
  xero_hbar_clearing_account_id: 'HBAR Payments',
  xero_usdc_clearing_account_id: 'USDC Payments',
  xero_usdt_clearing_account_id: 'USDT Payments',
  xero_audd_clearing_account_id: 'AUDD Payments',
  xero_wise_clearing_account_id: 'Wise Payments',
};

/** Plain-English explanations shown above each mapping field. */
export const XERO_MAPPING_GUIDANCE: Partial<Record<XeroMappingField, string>> = {
  xero_revenue_account_id:
    'When customers pay invoices, Provvy records revenue into this Xero account.',
  xero_receivable_account_id:
    'Before invoices are paid they are stored here.',
  xero_fee_expense_account_id:
    'Payment processing fees from Stripe are recorded here.',
  xero_stripe_clearing_account_id:
    'Stripe temporarily holds funds before paying your bank account. Provvy uses this account to reconcile those settlements automatically.',
  xero_hbar_clearing_account_id:
    'HBAR payments are held here briefly before settling to your bank account.',
  xero_usdc_clearing_account_id:
    'USDC stablecoin payments are held here briefly before settling to your bank account.',
  xero_usdt_clearing_account_id:
    'USDT stablecoin payments are held here briefly before settling to your bank account.',
  xero_audd_clearing_account_id:
    'AUDD stablecoin payments are held here briefly before settling to your bank account.',
};

export const CLEARING_ACCOUNTS_EXPLANATION = {
  title: 'Why do I need these?',
  body: 'Stripe and blockchain payments settle differently from bank transfers. Provvy recommends temporary clearing accounts to keep reconciliation accurate.',
  action: "We'll create these automatically inside Xero.",
  reassurance: 'Nothing in your existing chart of accounts will be deleted.',
} as const;

export const MAPPING_SUMMARY_INTRO = {
  title: 'Your accounting setup',
  footer:
    'Provvy will automatically use these accounts whenever invoices or payments sync to Xero.',
} as const;

export const QUEUE_GUIDANCE = {
  title: 'Payments Waiting to Sync',
  intro: (count: number) =>
    `Provvy has found ${count} historical payment${count === 1 ? '' : 's'} ready to send to Xero.`,
  context:
    "This commonly happens immediately after connecting Xero. Processing the queue will safely sync any payments that haven't already been exported.",
  empty: 'No payments are waiting to sync right now. New payments will sync automatically.',
  queueMissedLabel: 'Find missed payments',
  processQueueLabel: 'Sync payments to Xero',
} as const;

export type SyncStatusKey = 'PENDING' | 'RETRYING' | 'SUCCESS' | 'FAILED';

export const SYNC_STATUS_GUIDANCE: Record<
  SyncStatusKey,
  { label: string; explanation: string }
> = {
  PENDING: {
    label: 'Pending',
    explanation: 'Waiting to be sent to Xero.',
  },
  RETRYING: {
    label: 'Retrying',
    explanation: 'Provvy is automatically retrying this payment.',
  },
  SUCCESS: {
    label: 'Synced',
    explanation: 'This payment was successfully sent to Xero.',
  },
  FAILED: {
    label: 'Failed',
    explanation: "This payment couldn't be matched to a Xero invoice.",
  },
};

export type XeroSetupStepId =
  | 'connected'
  | 'business_selected'
  | 'organisation_linked'
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
    { id: 'connected', label: 'Connected', complete: input.connected },
    { id: 'business_selected', label: 'Business selected', complete: input.connected && hasTenant },
    {
      id: 'organisation_linked',
      label: 'Organisation linked',
      complete: input.connected && hasTenant,
    },
    { id: 'mappings_reviewed', label: 'Review account mappings', complete: mappingsComplete },
    {
      id: 'historical_processed',
      label: 'Process historical payments',
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
};
