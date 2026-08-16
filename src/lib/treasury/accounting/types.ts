import type { ReconciliationChainStatus, TreasuryReconciliationException } from '@/lib/treasury/reconciliation/types';

/** How a stage appears in the accountant UI — distinct from treasury event status. */
export type AccountingDisplayStatus =
  | 'posted_to_xero'
  | 'observed'
  | 'requires_review'
  | 'awaiting_bank_confirmation'
  | 'not_applicable';

export type TreasuryAccountingRevenueSection = {
  invoiceAmount: string | null;
  invoiceCurrency: string | null;
  accountingAmount: string | null;
  accountingCurrency: string | null;
  revenueAccountCode: string | null;
  xeroInvoiceSyncStatus: string | null;
  xeroInvoiceId: string | null;
  accountingStatus: AccountingDisplayStatus;
};

export type TreasuryAccountingCustomerPaymentSection = {
  paymentAmount: string | null;
  paymentCurrency: string | null;
  paymentRail: string | null;
  asset: string | null;
  paymentEventId: string | null;
  paymentConfirmedAt: string | null;
  transactionReference: string | null;
  xeroPaymentSyncStatus: string | null;
  xeroPaymentId: string | null;
  holdingAccountCode: string | null;
  holdingAccountName: string | null;
  treasuryStatus: string | null;
  accountingStatus: AccountingDisplayStatus;
};

export type TreasuryAccountingLifecycleStage = {
  stage: string;
  label: string;
  eventType: string | null;
  asset: string | null;
  destinationAsset: string | null;
  amount: string | null;
  destinationAmount: string | null;
  feeAmount: string | null;
  exchangeRate: string | null;
  provider: string | null;
  occurredAt: string | null;
  transactionReference: string | null;
  providerReference: string | null;
  sourceAddress: string | null;
  destinationAddress: string | null;
  treasuryStatus: string;
  accountingStatus: AccountingDisplayStatus;
  evidence: {
    strategy: string | null;
    manual: boolean;
    linkStatus: string | null;
  } | null;
  eventId: string | null;
  manualReconciliation: {
    linkedAt: string;
    linkedByUserId: string;
    notes: string | null;
  } | null;
};

export type TreasuryAccountingView = {
  paymentLinkId: string;
  invoiceReference: string | null;
  chainStatus: ReconciliationChainStatus;
  revenue: TreasuryAccountingRevenueSection;
  customerPayment: TreasuryAccountingCustomerPaymentSection;
  lifecycleStages: TreasuryAccountingLifecycleStage[];
  exceptions: TreasuryReconciliationException[];
  metricsHint: {
    requiresAccountantReview: boolean;
    awaitingBankConfirmation: boolean;
  };
  explanations: string[];
};

export type TreasuryAccountingSummary = {
  paymentLinkId: string;
  invoiceReference: string | null;
  invoiceAmount: string | null;
  invoiceCurrency: string | null;
  asset: string | null;
  chainStatus: ReconciliationChainStatus;
  xeroPaymentPosted: boolean;
  requiresReview: boolean;
};

export type TreasuryAccountingMetrics = {
  cryptoAwaitingConversion: number;
  paymentsNotAtExchange: number;
  unreconciledConversions: number;
  audAtExchange: number;
  audAwaitingBankConfirmation: number;
  exchangeFeesTotal: number;
  itemsRequiringAccountantReview: number;
  fullyReconciledChains: number;
};
