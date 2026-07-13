/**
 * Reconciliation status derivation.
 */

import { CommercialReconciliationStatus } from '@/lib/commercial-reconciliation/types';
import type { BankSettlementView } from '@/lib/commercial-reconciliation/types';
import type { PaymentAllocationResult } from '@/lib/commercial-reconciliation/derive-payment-allocation';

export type ReconciliationStatusInput = {
  linkStatus: string;
  allocation: PaymentAllocationResult;
  bankSettlement: BankSettlementView | null;
  hasPaymentEvents: boolean;
  reconciliationFailed?: boolean;
};

/** Derive explicit commercial reconciliation status. */
export function deriveReconciliationStatus(
  input: ReconciliationStatusInput
): CommercialReconciliationStatus {
  if (input.reconciliationFailed) {
    return CommercialReconciliationStatus.Failed;
  }

  if (
    input.linkStatus === 'REQUIRES_REVIEW' ||
    input.linkStatus === 'PAID_UNVERIFIED'
  ) {
    return CommercialReconciliationStatus.RequiresReview;
  }

  if (input.bankSettlement?.status === 'cleared') {
    return CommercialReconciliationStatus.Cleared;
  }

  if (!input.hasPaymentEvents) {
    return CommercialReconciliationStatus.Pending;
  }

  if (input.allocation.isFullyAllocated || input.linkStatus === 'PAID') {
    return CommercialReconciliationStatus.Matched;
  }

  if (input.allocation.isPartiallyAllocated) {
    return CommercialReconciliationStatus.PartiallyMatched;
  }

  if (input.bankSettlement?.status === 'failed') {
    return CommercialReconciliationStatus.Failed;
  }

  return CommercialReconciliationStatus.Pending;
}

/** Whether participant settlement may proceed after commercial reconciliation. */
export function isSettlementEligibleAfterReconciliation(
  status: CommercialReconciliationStatus
): boolean {
  return (
    status === CommercialReconciliationStatus.Matched ||
    status === CommercialReconciliationStatus.Cleared
  );
}
