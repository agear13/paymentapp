export const RECONCILIATION_TOLERANCE = 0.01;

export type ReconciliationRailKey =
  | 'stripe'
  | 'wise'
  | 'hedera_hbar'
  | 'hedera_usdc'
  | 'hedera_usdt'
  | 'hedera_audd';

export type ReconciliationRailItem = {
  expectedRevenue: number;
  ledgerBalance: number;
  difference: number;
  paymentCount: number;
};

export type ReconciliationReportData = {
  report: Record<ReconciliationRailKey, ReconciliationRailItem>;
  isReconciled: boolean;
  totalDifference: number;
  timestamp: string;
};

export function isRailBalanced(difference: number): boolean {
  return Math.abs(difference) < RECONCILIATION_TOLERANCE;
}
