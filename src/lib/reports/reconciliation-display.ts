import { formatCurrency } from '@/lib/formatters/format-currency';
import {
  isRailBalanced,
  RECONCILIATION_TOLERANCE,
  type ReconciliationRailKey,
  type ReconciliationReportData,
} from '@/lib/reports/reconciliation-types';

export const RECONCILIATION_RAIL_LABELS: Record<ReconciliationRailKey, string> = {
  stripe: 'Stripe',
  wise: 'Wise',
  hedera_hbar: 'HBAR',
  hedera_usdc: 'USDC',
  hedera_usdt: 'USDT',
  hedera_audd: 'AUDD',
};

export function countReconciliationDiscrepancies(
  report: ReconciliationReportData['report']
): number {
  return (Object.keys(report) as ReconciliationRailKey[]).filter(
    (key) => !isRailBalanced(report[key].difference)
  ).length;
}

export function getReconciliationHeadline(
  data: ReconciliationReportData,
  currencyCode = 'AUD'
): string {
  const discrepancies = countReconciliationDiscrepancies(data.report);

  if (data.isReconciled || discrepancies === 0) {
    return 'All accounts reconciled';
  }

  if (discrepancies === 1) {
    const rail = (Object.keys(data.report) as ReconciliationRailKey[]).find(
      (key) => !isRailBalanced(data.report[key].difference)
    );
    if (rail) {
      const label = RECONCILIATION_RAIL_LABELS[rail];
      const diff = formatCurrency(Math.abs(data.report[rail].difference), currencyCode);
      return `${label} clearing differs by ${diff}`;
    }
    return '1 discrepancy detected';
  }

  return `${discrepancies} discrepancies detected`;
}

export function getTotalReconciledVolume(
  report: ReconciliationReportData['report']
): number {
  return (Object.keys(report) as ReconciliationRailKey[]).reduce(
    (sum, key) => sum + report[key].expectedRevenue,
    0
  );
}

export function isReconciliationBalanced(difference: number): boolean {
  return Math.abs(difference) < RECONCILIATION_TOLERANCE;
}

export type ReconciliationHeroState =
  | 'reconciled'
  | 'discrepancy'
  | 'no_activity'
  | 'sync_pending';

export function countReconciledRails(
  report: ReconciliationReportData['report']
): number {
  return (Object.keys(report) as ReconciliationRailKey[]).filter((key) => {
    const item = report[key];
    const hasRailActivity =
      item.paymentCount > 0 || item.expectedRevenue > 0 || item.ledgerBalance !== 0;
    if (!hasRailActivity) return true;
    return isRailBalanced(item.difference);
  }).length;
}

export function countReconciledTransactions(
  report: ReconciliationReportData['report']
): number {
  return (Object.keys(report) as ReconciliationRailKey[]).reduce(
    (sum, key) => sum + report[key].paymentCount,
    0
  );
}

export function hasReconciliationActivity(
  report: ReconciliationReportData['report']
): boolean {
  return countReconciledTransactions(report) > 0;
}

export function getReconciliationHeroState(
  data: ReconciliationReportData | null,
  loadError: boolean
): ReconciliationHeroState {
  if (loadError || !data) return 'sync_pending';
  if (!hasReconciliationActivity(data.report)) return 'no_activity';
  if (data.isReconciled) return 'reconciled';
  return 'discrepancy';
}

export function getReconciliationHeroHeadline(
  state: ReconciliationHeroState,
  discrepancyCount: number
): string {
  switch (state) {
    case 'reconciled':
      return 'All payment rails reconciled';
    case 'discrepancy':
      return discrepancyCount === 1
        ? '1 reconciliation issue requires review'
        : `${discrepancyCount} reconciliation issues require review`;
    case 'no_activity':
      return 'No payments to reconcile yet';
    case 'sync_pending':
      return 'Reconciliation status unavailable';
  }
}
