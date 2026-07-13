/**
 * Commercial Reconciliation — canonical domain types.
 *
 * Commercial reconciliation matches payments to invoices using commercial identity
 * (agreement, invoice, payment link) — not bank-feed heuristics.
 *
 * Accounting systems consume reconciliation results; they do not discover relationships.
 */

import type { PaymentRailId } from '@/lib/payments/payment-rail-registry';
import type { XeroMappingField } from '@/lib/accounting/recommended-accounting-config';

/** Explicit commercial reconciliation states — derived, backwards compatible. */
export enum CommercialReconciliationStatus {
  Pending = 'Pending',
  Matched = 'Matched',
  PartiallyMatched = 'PartiallyMatched',
  Cleared = 'Cleared',
  RequiresReview = 'RequiresReview',
  Failed = 'Failed',
}

export const COMMERCIAL_RECONCILIATION_STATUS_LABELS: Record<
  CommercialReconciliationStatus,
  string
> = {
  [CommercialReconciliationStatus.Pending]: 'Pending',
  [CommercialReconciliationStatus.Matched]: 'Commercially Reconciled',
  [CommercialReconciliationStatus.PartiallyMatched]: 'Partially Reconciled',
  [CommercialReconciliationStatus.Cleared]: 'Bank Cleared',
  [CommercialReconciliationStatus.RequiresReview]: 'Requires Review',
  [CommercialReconciliationStatus.Failed]: 'Failed',
};

/** Normalized payment event — provider adapters produce this; engine consumes only this. */
export type CommercialPaymentEvent = {
  id: string;
  paymentLinkId: string;
  paymentEventId: string;
  amount: number;
  currency: string;
  receivedAt: string;
  paymentRail: PaymentRailId;
  providerReference: string | null;
  agreementId?: string | null;
  organizationId?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** Commercial identity Provvypay already owns — no heuristic matching. */
export type CommercialIdentity = {
  paymentLinkId: string;
  invoiceId: string;
  agreementId: string | null;
  organizationId: string;
  merchantId: string;
  participantId?: string | null;
  settlementId?: string | null;
};

/** Configurable clearing account mapping — references config, not hardcoded chart codes. */
export type ClearingAccountMapping = {
  railId: PaymentRailId;
  /** Stable config key for merchant/accounting configuration lookup. */
  configKey: string;
  /** Default recommended account name (from accounting config). */
  defaultAccountName: string;
  /** Xero mapping field when configured — null until merchant maps. */
  mappingField: XeroMappingField | null;
  /** Operator-facing label. */
  label: string;
  /** Resolved account code from merchant settings — optional override. */
  configuredAccountCode?: string | null;
};

export type PaymentAllocationType = 'full' | 'partial' | 'overpayment' | 'unallocated';

export type PaymentAllocation = {
  paymentEventId: string;
  amount: number;
  currency: string;
  allocatedAt: string;
  allocationType: PaymentAllocationType;
  paymentRail: PaymentRailId;
};

export type BankSettlementView = {
  status: 'pending' | 'cleared' | 'failed';
  settledAt: string | null;
  reference: string | null;
  provider: string | null;
};

/** Full commercial reconciliation record for an invoice + payment(s). */
export type CommercialReconciliation = {
  reconciliationId: string;
  invoiceId: string;
  paymentLinkId: string;
  agreementId: string | null;
  paymentEventId: string | null;
  paymentRail: PaymentRailId | null;
  clearingAccount: ClearingAccountMapping | null;
  settlementReference: string | null;
  reconciliationStatus: CommercialReconciliationStatus;
  matchedAmount: number;
  remainingAmount: number;
  invoiceAmount: number;
  currency: string;
  allocations: PaymentAllocation[];
  commercialIdentity: CommercialIdentity;
  bankSettlement: BankSettlementView | null;
  /** True when reconciliation is complete enough for participant settlement. */
  settlementEligible: boolean;
  /** ISO timestamp when commercial match was derived. */
  reconciledAt: string | null;
};

export type CommercialReconciliationInput = {
  paymentLinkId: string;
  invoiceAmount: number;
  currency: string;
  organizationId: string;
  agreementId?: string | null;
  participantId?: string | null;
  linkStatus: string;
  paymentEvents: CommercialPaymentEvent[];
  bankSettlements?: BankSettlementView[];
  /** Merchant-configured clearing account codes keyed by mapping field. */
  clearingAccountOverrides?: Partial<Record<XeroMappingField, string>>;
};

export type AccountingReconciliationExportContext = {
  paymentRail: PaymentRailId | null;
  paymentRailLabel: string | null;
  clearingAccount: ClearingAccountMapping | null;
  reconciliationStatus: CommercialReconciliationStatus;
  reconciliationStatusLabel: string;
  settlementReference: string | null;
  matchedAmount: number;
  remainingAmount: number;
  settlementEligible: boolean;
};
