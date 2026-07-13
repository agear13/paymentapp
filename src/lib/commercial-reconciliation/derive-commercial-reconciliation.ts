/**
 * Canonical commercial reconciliation engine.
 *
 * Single source of truth — all payment rails normalize through adapters first.
 */

import { deriveClearingAccount } from '@/lib/commercial-reconciliation/derive-clearing-account';
import { deriveBankSettlementFromList } from '@/lib/commercial-reconciliation/derive-bank-settlement';
import { derivePaymentAllocation } from '@/lib/commercial-reconciliation/derive-payment-allocation';
import {
  deriveReconciliationStatus,
  isSettlementEligibleAfterReconciliation,
} from '@/lib/commercial-reconciliation/derive-reconciliation-status';
import {
  normalizeCommercialPaymentEvents,
  type RawPaymentEventInput,
} from '@/lib/commercial-reconciliation/adapters/reconciliation-rail-adapters';
import {
  COMMERCIAL_RECONCILIATION_STATUS_LABELS,
  CommercialReconciliationStatus,
  type AccountingReconciliationExportContext,
  type CommercialIdentity,
  type CommercialReconciliation,
  type CommercialReconciliationInput,
} from '@/lib/commercial-reconciliation/types';
import type { PaymentRailId } from '@/lib/payments/payment-rail-registry';
import { getPaymentRail } from '@/lib/payments/payment-rail-registry';
import type { XeroMappingField } from '@/lib/accounting/recommended-accounting-config';

export type DeriveCommercialReconciliationInput = CommercialReconciliationInput & {
  rawPaymentEvents?: RawPaymentEventInput[];
};

/** Build deterministic reconciliation id. */
export function commercialReconciliationId(paymentLinkId: string): string {
  return `${paymentLinkId}:commercial_reconciliation`;
}

function buildCommercialIdentity(input: DeriveCommercialReconciliationInput): CommercialIdentity {
  return {
    paymentLinkId: input.paymentLinkId,
    invoiceId: input.paymentLinkId,
    agreementId: input.agreementId ?? null,
    organizationId: input.organizationId,
    merchantId: input.organizationId,
    participantId: input.participantId ?? null,
  };
}

/**
 * Derive full commercial reconciliation for an invoice and its payments.
 * Uses commercial identity — no bank-feed heuristics.
 */
export function deriveCommercialReconciliation(
  input: DeriveCommercialReconciliationInput
): CommercialReconciliation {
  const context = {
    paymentLinkId: input.paymentLinkId,
    organizationId: input.organizationId,
    agreementId: input.agreementId,
  };

  const events =
    input.paymentEvents.length > 0
      ? input.paymentEvents
      : input.rawPaymentEvents
        ? normalizeCommercialPaymentEvents(input.rawPaymentEvents, context)
        : [];

  const allocation = derivePaymentAllocation(input.invoiceAmount, events);
  const bankSettlement = deriveBankSettlementFromList(input.bankSettlements ?? []);

  const status = deriveReconciliationStatus({
    linkStatus: input.linkStatus,
    allocation,
    bankSettlement,
    hasPaymentEvents: events.length > 0,
  });

  const primaryEvent = events.at(-1) ?? null;
  const paymentRail: PaymentRailId | null = primaryEvent?.paymentRail ?? null;

  const clearingAccount = paymentRail
    ? deriveClearingAccount(paymentRail, input.clearingAccountOverrides)
    : null;

  const settlementEligible = isSettlementEligibleAfterReconciliation(status);

  const matchedAmount = Math.min(allocation.totalAllocated, input.invoiceAmount);
  const remainingAmount = allocation.remainingAmount;

  const reconciledAt =
    status === CommercialReconciliationStatus.Pending
      ? null
      : primaryEvent?.receivedAt ?? new Date().toISOString();

  return {
    reconciliationId: commercialReconciliationId(input.paymentLinkId),
    invoiceId: input.paymentLinkId,
    paymentLinkId: input.paymentLinkId,
    agreementId: input.agreementId ?? null,
    paymentEventId: primaryEvent?.paymentEventId ?? null,
    paymentRail,
    clearingAccount,
    settlementReference:
      bankSettlement?.reference ?? primaryEvent?.providerReference ?? null,
    reconciliationStatus: status,
    matchedAmount,
    remainingAmount,
    invoiceAmount: input.invoiceAmount,
    currency: input.currency,
    allocations: allocation.allocations,
    commercialIdentity: buildCommercialIdentity(input),
    bankSettlement,
    settlementEligible,
    reconciledAt,
  };
}

/** Build accounting export enrichment context — no export behaviour changes. */
export function buildAccountingReconciliationExportContext(
  reconciliation: CommercialReconciliation
): AccountingReconciliationExportContext {
  const paymentRailLabel = reconciliation.paymentRail
    ? getPaymentRail(reconciliation.paymentRail).displayLabel
    : null;

  return {
    paymentRail: reconciliation.paymentRail,
    paymentRailLabel,
    clearingAccount: reconciliation.clearingAccount,
    reconciliationStatus: reconciliation.reconciliationStatus,
    reconciliationStatusLabel:
      COMMERCIAL_RECONCILIATION_STATUS_LABELS[reconciliation.reconciliationStatus],
    settlementReference: reconciliation.settlementReference,
    matchedAmount: reconciliation.matchedAmount,
    remainingAmount: reconciliation.remainingAmount,
    settlementEligible: reconciliation.settlementEligible,
  };
}

/** Convenience: derive reconciliation export context in one call. */
export function deriveAccountingReconciliationContext(
  input: DeriveCommercialReconciliationInput
): AccountingReconciliationExportContext {
  return buildAccountingReconciliationExportContext(
    deriveCommercialReconciliation(input)
  );
}

export type { XeroMappingField };
