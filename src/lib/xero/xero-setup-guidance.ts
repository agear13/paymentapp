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
  title: 'Xero connected',
  body: 'Your Xero business is linked to Provvy.',
  nextStep:
    'Next, choose which Xero accounts Provvy should use for invoices and payments.',
  continueLabel: 'Continue setup',
} as const;

/** Friendly labels for mapping summary (left side of arrow). */
export const MAPPING_SUMMARY_FRIENDLY_LABELS: Partial<Record<XeroMappingField, string>> = {
  xero_revenue_account_id: 'Sales from invoices',
  xero_receivable_account_id: 'Unpaid invoices',
  xero_fee_expense_account_id: 'Card processing fees',
  xero_stripe_clearing_account_id: 'Stripe payments',
  xero_hbar_clearing_account_id: 'HBAR payments',
  xero_usdc_clearing_account_id: 'USDC payments',
  xero_usdt_clearing_account_id: 'USDT payments',
  xero_audd_clearing_account_id: 'AUDD payments',
  xero_wise_clearing_account_id: 'Wise payments',
};

/** Plain-English explanations shown above each mapping field. */
export const XERO_MAPPING_GUIDANCE: Partial<Record<XeroMappingField, string>> = {
  xero_revenue_account_id:
    'When customers pay invoices, Provvy records sales in this Xero account.',
  xero_receivable_account_id:
    'Unpaid invoices are tracked here until customers pay.',
  xero_fee_expense_account_id:
    'Stripe card processing fees are recorded here.',
  xero_stripe_clearing_account_id:
    'Stripe temporarily holds funds before paying your bank. Provvy uses this holding account to match settlements automatically.',
  xero_hbar_clearing_account_id:
    'HBAR payments are held here briefly before settling to your bank account.',
  xero_usdc_clearing_account_id:
    'USDC stablecoin payments are held here briefly before settling to your bank account.',
  xero_usdt_clearing_account_id:
    'USDT stablecoin payments are held here briefly before settling to your bank account.',
  xero_audd_clearing_account_id:
    'AUDD stablecoin payments are held here briefly before settling to your bank account.',
};

export const CLEARING_ACCOUNT_HELPER_TEXT =
  'Temporary holding account used until funds reach your bank account.';

export const ADVANCED_SETTLEMENT_SECTION_COPY =
  'Digital asset payments are recorded in temporary holding accounts before settling to your bank. Your accountant can adjust these if needed.';

export const CLEARING_ACCOUNTS_EXPLANATION = {
  title: 'Why add holding accounts?',
  body: 'Stripe and other payment methods settle differently from bank transfers. Temporary holding accounts keep reconciliation accurate.',
  action: 'Provvy can add these in Xero for you.',
  reassurance: 'Nothing in your existing Xero accounts will be deleted.',
} as const;

export const MAPPING_SUMMARY_INTRO = {
  title: 'Saved account choices',
  footer:
    'Provvy uses these saved accounts whenever invoices or payments sync to Xero.',
} as const;

export const QUEUE_GUIDANCE = {
  title: 'Past payments sent to Xero',
  intro: (count: number) =>
    `Provvy has found ${count} historical payment${count === 1 ? '' : 's'} ready to send to Xero.`,
  context:
    'This commonly happens immediately after connecting Xero. Provvy will sync these automatically — use Find missed payments if anything was paid before you connected.',
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
