/**
 * Chargeback reconciliation extension point — not yet implemented.
 */

import type { CommercialReconciliation } from '@/lib/commercial-reconciliation/types';

export type ChargebackReconciliationPlaceholder = {
  status: 'not_implemented';
  originalReconciliationId: string;
  chargebackAmount: number;
  message: string;
};

export function deriveChargebackReconciliation(
  reconciliation: CommercialReconciliation,
  chargebackAmount: number
): ChargebackReconciliationPlaceholder {
  return {
    status: 'not_implemented',
    originalReconciliationId: reconciliation.reconciliationId,
    chargebackAmount,
    message: 'Chargeback reconciliation will flag RequiresReview and adjust clearing when implemented.',
  };
}
