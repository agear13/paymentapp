/**
 * Accounting Workflow — bookkeeping integration lifecycle.
 *
 * Downstream projection only. Never influences commercial or settlement state.
 */
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { deriveAccountingExport } from '@/lib/commercial/accounting-export';
import type { AccountingSyncStatus } from '@/lib/commercial/accounting-connector';
import {
  buildParticipantAccountingInput,
  type ParticipantWorkflowInputContext,
} from '@/lib/commercial/workflows/build-participant-workflow-inputs';
import {
  ACCOUNTING_WORKFLOW_LABELS,
  type AccountingWorkflowState,
  type ProjectWorkflowContext,
} from '@/lib/commercial/workflows/types';

export type AccountingWorkflowResult = {
  state: AccountingWorkflowState;
  label: string;
  exportModel: ReturnType<typeof deriveAccountingExport> | null;
};

function mapSyncStatusToWorkflowState(
  syncStatus: AccountingSyncStatus,
  participant: DemoParticipant
): AccountingWorkflowState {
  const ps = participant.paymentSetup;
  if (ps?.xeroLastAttemptAt && !ps?.xeroExportedAt && ps?.xeroSyncStatus === 'pending') {
    return 'QUEUED';
  }

  if (ps?.xeroExportedAt && ps?.xeroSyncStatus === 'synced') {
    return 'SYNCED';
  }

  switch (syncStatus) {
    case 'exported':
      return 'EXPORTED';
    case 'exporting':
      return 'QUEUED';
    case 'failed':
    case 'needs_review':
    case 're_export_required':
      return 'FAILED';
    case 'ready':
    default:
      return 'NOT_EXPORTED';
  }
}

/** Whether legacy organiser lifecycle treats the participant as accounting-synced. */
export function isParticipantAccountingSynced(participant: DemoParticipant): boolean {
  const ps = participant.paymentSetup;
  return Boolean(ps?.xeroExportedAt && ps?.xeroSyncStatus === 'synced');
}

/**
 * Derive accounting workflow state for a single participant.
 */
export function deriveParticipantAccountingWorkflowState(
  participant: DemoParticipant,
  context: ParticipantWorkflowInputContext = {}
): AccountingWorkflowResult {
  const input = buildParticipantAccountingInput(participant, context);
  const projectId = context.projectId ?? participant.dealId ?? 'project';

  const exportModel = deriveAccountingExport(input, {
    projectId,
    projectName: context.projectName ?? null,
    defaultProvider: 'xero',
  });

  if (exportModel.notApplicable) {
    return {
      state: 'NOT_REQUIRED',
      label: ACCOUNTING_WORKFLOW_LABELS.NOT_REQUIRED,
      exportModel,
    };
  }

  const state = mapSyncStatusToWorkflowState(exportModel.status, participant);

  return {
    state,
    label: ACCOUNTING_WORKFLOW_LABELS[state],
    exportModel,
  };
}

/** Derive accounting workflow states for all participants in a project. */
export function deriveAccountingState(
  context: ProjectWorkflowContext
): AccountingWorkflowResult[] {
  const inputContext: ParticipantWorkflowInputContext = {
    projectId: context.projectId,
    projectName: context.projectName,
  };
  return context.participants.map((participant) =>
    deriveParticipantAccountingWorkflowState(participant, inputContext)
  );
}
