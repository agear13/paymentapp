/**
 * Generic accounting integration copy for Commercial OS (provider-agnostic UX).
 * Use Xero-specific copy only on provider setup screens.
 */

export const ACCOUNTING_INTEGRATION_COPY = {
  sectionTitle: 'Accounting',
  notConnectedStatus: 'Not connected',
  connectedStatus: 'Connected',
  setupIncompleteStatus: 'Setup incomplete',
  notConnectedDescription:
    'Automatically sync invoices to your accounting software.',
  firstInvoiceBannerTitle: 'Automatically sync invoices to your accounting software',
  firstInvoiceBannerBody:
    'Save time by pushing invoices directly into your accounting software.',
  connectCta: 'Connect Accounting',
  pushCta: 'Push to Accounting',
  updateAccountingCta: 'Update Accounting Record',
  alreadySyncedLabel: 'Already synced',
  syncInProgressLabel: 'Sync in progress…',
  alreadySyncedToast: 'This invoice is already synced to your accounting software.',
  updateQueuedToast: 'Accounting record update queued.',
  localChangesNotSyncedBody:
    'Provvy saved your changes. Use Update Accounting to sync them — accounting is never updated automatically.',
  editSyncedInvoiceWarningTitle: 'This invoice is synced to accounting',
  editSyncedInvoiceWarningBody:
    'Changes save in Provvy only. Accounting records are updated only when you choose Update Accounting.',
  continueSetupCta: 'Continue accounting setup',
  dismissBanner: 'Dismiss',
  historicalSyncBannerTitle: (count: number) =>
    `We found ${count} invoice${count === 1 ? '' : 's'} that haven't been synced to your accounting software.`,
  historicalSyncSyncAll: 'Sync All',
  historicalSyncReview: 'Review',
  historicalSyncDismiss: 'Dismiss',
  historicalSyncReviewTitle: 'Sync historical invoices',
  historicalSyncReviewSubtitle:
    'These invoices were created before accounting was connected. Choose what to sync — nothing runs until you confirm.',
  historicalSyncSyncSelected: 'Sync selected',
  historicalSyncSyncEverything: 'Sync everything',
  historicalSyncEmptyTitle: 'All caught up',
  historicalSyncEmptyBody: 'Every invoice is already synced to your accounting software.',
  historicalSyncQueuedToast: 'Invoices queued for accounting sync.',
  syncedInvoiceRemovalTitle: 'This invoice has already been synced to your accounting software.',
  syncedInvoiceRemovalIntro:
    "Choose how you'd like to handle this invoice.\n\nProvvy is your commercial system of record. If this invoice has already been exported to your accounting software, deleting it requires an accounting decision.",
  syncedInvoiceRemovalNoActions:
    'This invoice cannot be voided or archived from Provvy in its current state. Contact your administrator if you need to correct accounting records.',
  voidInvoiceAction: 'Void Invoice',
  voidInvoiceRecommended: 'Recommended',
  voidInvoiceLead:
    'Cancel this invoice in Provvy and void the corresponding invoice in Xero.',
  voidInvoiceWhenRecommended: 'Recommended if this invoice was created by mistake.',
  voidInvoiceBenefits: [
    'Removes the invoice from active commercial workflows',
    'Preserves your accounting audit trail',
    'Updates Xero so both systems stay aligned',
  ] as const,
  archiveInvoiceAction: 'Archive Invoice',
  archiveInvoiceLead:
    'Archive the invoice in Provvy while leaving the accounting record unchanged.',
  archiveInvoiceWhenRecommended:
    'Recommended if the invoice is no longer operationally relevant but should remain in your accounting records.',
  archiveInvoiceBenefits: [
    'Hidden from active work',
    'Accounting remains unchanged',
    'Can still be referenced later',
  ] as const,
  paidInvoiceVoidWarningTitle: 'This invoice has already been paid.',
  paidInvoiceVoidWarningBody:
    'Voiding it may require a credit note or refund in your accounting system.',
  paidInvoiceFutureNoticeTitle: 'Paid invoices and corrections',
  paidInvoiceFutureNoticeBody:
    'Paid invoices are often corrected using credit notes or refunds rather than being voided.\n\nProvvy currently follows your existing accounting workflow.',
  voidSuccessToastTitle: 'Invoice void requested.',
  voidSuccessToastBody:
    "Provvy has cancelled the invoice.\n\nWe'll now update Xero in the background.\n\nYou can monitor progress from the Accounting tab.",
  archiveSuccessToastTitle: 'Invoice archived.',
  archiveSuccessToastBody: 'Your accounting records have not been changed.',
  accountingActivityTitle: 'Accounting Activity',
  accountingActivityEmpty: 'No accounting activity yet.',
  consequenceProvvyLabel: 'Provvy',
  consequenceAccountingLabel: 'Accounting',
  consequenceHistoryRetained: 'Commercial history retained',
  voidConsequenceProvvy: 'Cancelled',
  voidConsequenceAccounting: 'Voided',
  archiveConsequenceProvvy: 'Archived',
  archiveConsequenceAccounting: 'No changes',
} as const;

export type AccountingProviderId = 'xero' | 'quickbooks' | 'myob';

export type AccountingProviderOption = {
  id: AccountingProviderId;
  name: string;
  description: string;
  available: boolean;
};

export const ACCOUNTING_PROVIDER_OPTIONS: AccountingProviderOption[] = [
  {
    id: 'xero',
    name: 'Xero',
    description: 'Sync invoices, payments, and journals.',
    available: true,
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Coming soon.',
    available: false,
  },
  {
    id: 'myob',
    name: 'MYOB',
    description: 'Coming soon.',
    available: false,
  },
];

export const CONNECT_ACCOUNTING_MODAL = {
  title: 'Connect Accounting',
  subtitle: 'Choose your accounting software. Invoices work without a connection — sync is optional.',
  comingSoon: 'Coming soon',
} as const;
