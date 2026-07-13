/**
 * Settlement Workflow — money movement lifecycle.
 *
 * Does NOT depend on accounting exports. Uses the settlement readiness engine
 * with accounting decoupled from settlement gates.
 */
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { deriveSettlementReadiness } from '@/lib/commercial/settlement-readiness';
import { hasApprovedAgreement } from '@/lib/operations/primitives/participant-earnings-primitives';
import {
  buildParticipantSettlementInput,
  type ParticipantWorkflowInputContext,
} from '@/lib/commercial/workflows/build-participant-workflow-inputs';
import {
  SETTLEMENT_WORKFLOW_LABELS,
  type ProjectWorkflowContext,
  type SettlementWorkflowState,
} from '@/lib/commercial/workflows/types';

export type SettlementWorkflowResult = {
  state: SettlementWorkflowState;
  label: string;
  readiness: ReturnType<typeof deriveSettlementReadiness> | null;
};

function settlementExecutionState(participant: DemoParticipant): SettlementWorkflowState | null {
  if (participant.payoutSettlementStatus === 'Paid' || participant.payoutPaidAt) {
    return 'COMPLETE';
  }
  return null;
}

/**
 * Derive settlement workflow state for a single participant.
 */
export function deriveParticipantSettlementWorkflowState(
  participant: DemoParticipant,
  context: ParticipantWorkflowInputContext = {}
): SettlementWorkflowResult {
  const execution = settlementExecutionState(participant);
  if (execution) {
    return {
      state: execution,
      label: SETTLEMENT_WORKFLOW_LABELS[execution],
      readiness: null,
    };
  }

  if (!hasApprovedAgreement(participant)) {
    return {
      state: 'NOT_STARTED',
      label: SETTLEMENT_WORKFLOW_LABELS.NOT_STARTED,
      readiness: null,
    };
  }

  const input = buildParticipantSettlementInput(participant, context);
  const readiness = deriveSettlementReadiness(input);

  if (readiness.readyToSettle) {
    return {
      state: 'READY',
      label: SETTLEMENT_WORKFLOW_LABELS.READY,
      readiness,
    };
  }

  if (readiness.blockers.some((b) => b.severity === 'critical')) {
    return {
      state: 'BLOCKED',
      label: SETTLEMENT_WORKFLOW_LABELS.BLOCKED,
      readiness,
    };
  }

  return {
    state: 'PENDING',
    label: SETTLEMENT_WORKFLOW_LABELS.PENDING,
    readiness,
  };
}

/** Derive settlement workflow states for all participants in a project. */
export function deriveSettlementState(
  context: ProjectWorkflowContext
): SettlementWorkflowResult[] {
  const inputContext: ParticipantWorkflowInputContext = {
    projectId: context.projectId,
    projectName: context.projectName,
  };
  return context.participants.map((participant) =>
    deriveParticipantSettlementWorkflowState(participant, inputContext)
  );
}
