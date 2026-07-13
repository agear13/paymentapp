/**
 * Commercial reconciliation reporting extension points.
 */

import type { ClearingAccountMapping } from '@/lib/commercial-reconciliation/types';
import type { CommercialReconciliation } from '@/lib/commercial-reconciliation/types';
import { CommercialReconciliationStatus } from '@/lib/commercial-reconciliation/types';

export type ReconciliationReportPlaceholder = {
  status: 'not_implemented';
  report: string;
  filters: Record<string, string | number | null>;
  message: string;
};

/** Outstanding clearing account balances — placeholder. */
export function deriveOutstandingClearingAccountsReport(
  clearingAccounts: ClearingAccountMapping[],
  reconciliations: CommercialReconciliation[]
): ReconciliationReportPlaceholder {
  const unreconciled = reconciliations.filter(
    (r) =>
      r.reconciliationStatus !== CommercialReconciliationStatus.Cleared &&
      r.reconciliationStatus !== CommercialReconciliationStatus.Matched
  ).length;

  return {
    status: 'not_implemented',
    report: 'outstanding_clearing_accounts',
    filters: {
      clearingAccountCount: clearingAccounts.length,
      unreconciledPaymentCount: unreconciled,
    },
    message: 'Outstanding clearing account report will aggregate by rail when dashboards are implemented.',
  };
}

export function deriveStripeClearingBalanceReport(
  reconciliations: CommercialReconciliation[]
): ReconciliationReportPlaceholder {
  const stripe = reconciliations.filter((r) => r.paymentRail === 'stripe');
  const outstanding = stripe.reduce((sum, r) => sum + r.remainingAmount, 0);
  return {
    status: 'not_implemented',
    report: 'stripe_clearing_balance',
    filters: { count: stripe.length, outstandingAmount: outstanding },
    message: 'Stripe clearing balance will derive from commercial reconciliation when dashboards are implemented.',
  };
}

export function deriveWiseClearingBalanceReport(
  reconciliations: CommercialReconciliation[]
): ReconciliationReportPlaceholder {
  const wise = reconciliations.filter((r) => r.paymentRail === 'wise');
  const outstanding = wise.reduce((sum, r) => sum + r.remainingAmount, 0);
  return {
    status: 'not_implemented',
    report: 'wise_clearing_balance',
    filters: { count: wise.length, outstandingAmount: outstanding },
    message: 'Wise clearing balance will derive from commercial reconciliation when dashboards are implemented.',
  };
}

export function deriveCryptoClearingBalanceReport(
  reconciliations: CommercialReconciliation[]
): ReconciliationReportPlaceholder {
  const crypto = reconciliations.filter(
    (r) =>
      r.paymentRail === 'crypto' ||
      r.paymentRail === 'hedera' ||
      r.paymentRail === 'evm_wallet'
  );
  const outstanding = crypto.reduce((sum, r) => sum + r.remainingAmount, 0);
  return {
    status: 'not_implemented',
    report: 'crypto_clearing_balance',
    filters: { count: crypto.length, outstandingAmount: outstanding },
    message: 'Crypto clearing balance will derive from commercial reconciliation when dashboards are implemented.',
  };
}

export function deriveUnreconciledPaymentsReport(
  reconciliations: CommercialReconciliation[]
): ReconciliationReportPlaceholder {
  const unreconciled = reconciliations.filter(
    (r) =>
      r.reconciliationStatus === CommercialReconciliationStatus.Pending ||
      r.reconciliationStatus === CommercialReconciliationStatus.RequiresReview ||
      r.reconciliationStatus === CommercialReconciliationStatus.Failed
  );
  return {
    status: 'not_implemented',
    report: 'unreconciled_payments',
    filters: { count: unreconciled.length },
    message: 'Unreconciled payments report will list invoices awaiting commercial match.',
  };
}

export function derivePartialAllocationsReport(
  reconciliations: CommercialReconciliation[]
): ReconciliationReportPlaceholder {
  const partial = reconciliations.filter(
    (r) => r.reconciliationStatus === CommercialReconciliationStatus.PartiallyMatched
  );
  return {
    status: 'not_implemented',
    report: 'partial_allocations',
    filters: {
      count: partial.length,
      totalRemaining: partial.reduce((s, r) => s + r.remainingAmount, 0),
    },
    message: 'Partial allocations report will surface invoices with incomplete payment allocation.',
  };
}
