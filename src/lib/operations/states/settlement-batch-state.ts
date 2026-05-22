/**
 * SETTLEMENT BATCH — reconciliation container for one or more payout releases.
 */

export const SETTLEMENT_BATCH_STATES = [
  'OPEN',
  'RECONCILING',
  'SETTLING',
  'COMPLETED',
  'FAILED',
] as const;

export type SettlementBatchState = (typeof SETTLEMENT_BATCH_STATES)[number];
