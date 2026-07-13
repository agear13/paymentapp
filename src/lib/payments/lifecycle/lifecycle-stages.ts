/**
 * Payment lifecycle stage definitions and display labels.
 */

import type { PaymentLifecycleStage } from '@prisma/client';

/** Canonical progression order for lifecycle stages. */
export const LIFECYCLE_STAGE_ORDER: readonly PaymentLifecycleStage[] = [
  'INVOICE_CREATED',
  'CUSTOMER_OPENED_LINK',
  'PAYMENT_REQUESTED',
  'PAYMENT_DETECTED',
  'PAYMENT_CONFIRMED',
  'BLOCKCHAIN_CONFIRMED',
  'FX_SNAPSHOT_LOCKED',
  'LEDGER_UPDATED',
  'ACCOUNTING_SYNC_STARTED',
  'ACCOUNTING_SYNC_COMPLETED',
  'ACCOUNTING_SYNC_FAILED',
  'SETTLEMENT_PENDING',
  'SETTLEMENT_IN_PROGRESS',
  'SETTLEMENT_COMPLETED',
  'RECONCILED',
  'COMPLETED',
] as const;

export const LIFECYCLE_STAGE_LABELS: Record<PaymentLifecycleStage, string> = {
  INVOICE_CREATED: 'Invoice Created',
  CUSTOMER_OPENED_LINK: 'Customer Opened Link',
  PAYMENT_REQUESTED: 'Payment Requested',
  PAYMENT_DETECTED: 'Payment Detected',
  PAYMENT_CONFIRMED: 'Payment Confirmed',
  BLOCKCHAIN_CONFIRMED: 'Blockchain Confirmed',
  FX_SNAPSHOT_LOCKED: 'FX Locked',
  LEDGER_UPDATED: 'Ledger Updated',
  ACCOUNTING_SYNC_STARTED: 'Accounting Sync Started',
  ACCOUNTING_SYNC_COMPLETED: 'Synced to Xero',
  ACCOUNTING_SYNC_FAILED: 'Accounting Sync Failed',
  SETTLEMENT_PENDING: 'Settlement Pending',
  SETTLEMENT_IN_PROGRESS: 'Settlement In Progress',
  SETTLEMENT_COMPLETED: 'Settled',
  RECONCILED: 'Reconciled',
  COMPLETED: 'Completed',
};

/** Merchant-facing lifecycle labels emphasising immediate export before payment. */
export const MERCHANT_LAYER_TIMELINE_STAGES = [
  { stage: 'INVOICE_CREATED' as const, label: 'Invoice Created' },
  { stage: 'ACCOUNTING_SYNC_COMPLETED' as const, label: 'Invoice Exported' },
  { stage: 'CUSTOMER_OPENED_LINK' as const, label: 'Awaiting Payment' },
  { stage: 'PAYMENT_CONFIRMED' as const, label: 'Payment Received' },
  { stage: 'FX_SNAPSHOT_LOCKED' as const, label: 'Invoice Paid' },
  { stage: 'SETTLEMENT_PENDING' as const, label: 'Settlement Ready' },
  { stage: 'SETTLEMENT_COMPLETED' as const, label: 'Settlement Completed' },
  { stage: 'RECONCILED' as const, label: 'Reconciled' },
] as const;

/** Stages shown in the merchant timeline UI (subset + ordered). */
export const TIMELINE_DISPLAY_STAGES: readonly PaymentLifecycleStage[] = [
  'INVOICE_CREATED',
  'ACCOUNTING_SYNC_COMPLETED',
  'CUSTOMER_OPENED_LINK',
  'PAYMENT_CONFIRMED',
  'FX_SNAPSHOT_LOCKED',
  'SETTLEMENT_PENDING',
  'SETTLEMENT_COMPLETED',
  'RECONCILED',
  'COMPLETED',
] as const;

export type PaymentHealthStatus =
  | 'AWAITING_PAYMENT'
  | 'PROCESSING'
  | 'AWAITING_SETTLEMENT'
  | 'SETTLEMENT_FAILED'
  | 'RECONCILED'
  | 'COMPLETED';

export const PAYMENT_HEALTH_LABELS: Record<PaymentHealthStatus, string> = {
  AWAITING_PAYMENT: 'Awaiting Payment',
  PROCESSING: 'Processing',
  AWAITING_SETTLEMENT: 'Awaiting Settlement',
  SETTLEMENT_FAILED: 'Settlement Failed',
  RECONCILED: 'Reconciled',
  COMPLETED: 'Completed',
};

export type LifecycleTimelineEntry = {
  id: string;
  stage: PaymentLifecycleStage;
  label: string;
  createdAt: Date;
  actor: string | null;
  provider: string | null;
  paymentEventId: string | null;
  metadata: Record<string, unknown> | null;
  reached: boolean;
};

export function stageIndex(stage: PaymentLifecycleStage): number {
  return LIFECYCLE_STAGE_ORDER.indexOf(stage);
}

export function isStageAtOrAfter(
  current: PaymentLifecycleStage | null | undefined,
  target: PaymentLifecycleStage
): boolean {
  if (!current) return false;
  return stageIndex(current) >= stageIndex(target);
}

export function maxLifecycleStage(
  stages: PaymentLifecycleStage[]
): PaymentLifecycleStage | null {
  if (stages.length === 0) return null;
  return stages.reduce((max, stage) =>
    stageIndex(stage) > stageIndex(max) ? stage : max
  );
}

export function merchantLayerTimelineLabel(stage: PaymentLifecycleStage): string {
  const match = MERCHANT_LAYER_TIMELINE_STAGES.find((item) => item.stage === stage);
  return match?.label ?? LIFECYCLE_STAGE_LABELS[stage];
}
