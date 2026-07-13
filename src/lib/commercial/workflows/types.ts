/**
 * Commercial Operations Platform — workflow state types.
 *
 * Three independent projections over the same participant payload:
 *   Commercial  — agreement & commercial execution
 *   Settlement  — money movement
 *   Accounting  — bookkeeping integrations (downstream only)
 */
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { SettlementReadinessResult } from '@/lib/commercial/settlement-readiness';
import type { AccountingExportModel } from '@/lib/commercial/accounting-export';

/* ─── Commercial workflow ─────────────────────────────────────────────────── */

export const COMMERCIAL_WORKFLOW_STATES = [
  'INVITED',
  'AGREEMENT_PENDING',
  'AGREEMENT_ACCEPTED',
  'COMMERCIALLY_ACTIVE',
  'OBLIGATIONS_OUTSTANDING',
  'COMMERCIAL_SETTLEMENT_READY',
  'COMMERCIALLY_COMPLETE',
] as const;

export type CommercialWorkflowState = (typeof COMMERCIAL_WORKFLOW_STATES)[number];

export const COMMERCIAL_WORKFLOW_LABELS: Record<CommercialWorkflowState, string> = {
  INVITED: 'Invited',
  AGREEMENT_PENDING: 'Agreement pending',
  AGREEMENT_ACCEPTED: 'Agreement accepted',
  COMMERCIALLY_ACTIVE: 'Commercially active',
  OBLIGATIONS_OUTSTANDING: 'Obligations outstanding',
  COMMERCIAL_SETTLEMENT_READY: 'Settlement ready',
  COMMERCIALLY_COMPLETE: 'Commercially complete',
};

/* ─── Settlement workflow ─────────────────────────────────────────────────── */

export const SETTLEMENT_WORKFLOW_STATES = [
  'NOT_STARTED',
  'BLOCKED',
  'PENDING',
  'READY',
  'INITIATED',
  'PROCESSING',
  'COMPLETE',
] as const;

export type SettlementWorkflowState = (typeof SETTLEMENT_WORKFLOW_STATES)[number];

export const SETTLEMENT_WORKFLOW_LABELS: Record<SettlementWorkflowState, string> = {
  NOT_STARTED: 'Not started',
  BLOCKED: 'Settlement blocked',
  PENDING: 'Settlement pending',
  READY: 'Settlement ready',
  INITIATED: 'Settlement initiated',
  PROCESSING: 'Settlement processing',
  COMPLETE: 'Settlement complete',
};

/* ─── Accounting workflow ─────────────────────────────────────────────────── */

export const ACCOUNTING_WORKFLOW_STATES = [
  'NOT_REQUIRED',
  'NOT_EXPORTED',
  'QUEUED',
  'EXPORTED',
  'SYNCED',
  'FAILED',
] as const;

export type AccountingWorkflowState = (typeof ACCOUNTING_WORKFLOW_STATES)[number];

export const ACCOUNTING_WORKFLOW_LABELS: Record<AccountingWorkflowState, string> = {
  NOT_REQUIRED: 'Not required',
  NOT_EXPORTED: 'Not exported',
  QUEUED: 'Queued',
  EXPORTED: 'Exported',
  SYNCED: 'Synced',
  FAILED: 'Failed',
};

/* ─── Project / participant bundles ───────────────────────────────────────── */

export type ProjectWorkflowContext = {
  projectId?: string;
  projectName?: string | null;
  participants: DemoParticipant[];
};

export type ParticipantWorkflowBundle = {
  participantId: string;
  commercial: {
    state: CommercialWorkflowState;
    label: string;
  };
  settlement: {
    state: SettlementWorkflowState;
    label: string;
    readiness: SettlementReadinessResult | null;
  };
  accounting: {
    state: AccountingWorkflowState;
    label: string;
    exportModel: AccountingExportModel | null;
  };
};

export type ProjectWorkflowBundle = {
  projectId?: string;
  participants: ParticipantWorkflowBundle[];
};

export type ParticipantWorkflowBadges = {
  commercialStatus: string;
  settlementStatus: string;
  accountingStatus: string;
};
