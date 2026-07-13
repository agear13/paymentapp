/**
 * Refund reconciliation extension point — not yet implemented.
 */

import type { CommercialReconciliation } from '@/lib/commercial-reconciliation/types';

export type RefundReconciliationPlaceholder = {
  status: 'not_implemented';
  originalReconciliationId: string;
  refundAmount: number;
  message: string;
};

export function deriveRefundReconciliation(
  reconciliation: CommercialReconciliation,
  refundAmount: number
): RefundReconciliationPlaceholder {
  return {
    status: 'not_implemented',
    originalReconciliationId: reconciliation.reconciliationId,
    refundAmount,
    message: 'Refund reconciliation will adjust allocations against the original commercial match when implemented.',
  };
}
