/**
 * Composes the three independent workflow projections for a participant.
 */
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { deriveParticipantCommercialWorkflowState } from '@/lib/commercial/workflows/derive-commercial-state';
import { deriveParticipantSettlementWorkflowState } from '@/lib/commercial/workflows/derive-settlement-state';
import { deriveParticipantAccountingWorkflowState } from '@/lib/commercial/workflows/derive-accounting-state';
import type {
  ParticipantWorkflowBadges,
  ParticipantWorkflowBundle,
  ProjectWorkflowBundle,
  ProjectWorkflowContext,
} from '@/lib/commercial/workflows/types';
import type { ParticipantWorkflowInputContext } from '@/lib/commercial/workflows/build-participant-workflow-inputs';

export function deriveParticipantWorkflows(
  participant: DemoParticipant,
  context: ParticipantWorkflowInputContext = {}
): ParticipantWorkflowBundle {
  const commercial = deriveParticipantCommercialWorkflowState(participant);
  const settlement = deriveParticipantSettlementWorkflowState(participant, context);
  const accounting = deriveParticipantAccountingWorkflowState(participant, context);

  return {
    participantId: participant.id,
    commercial: { state: commercial.state, label: commercial.label },
    settlement: {
      state: settlement.state,
      label: settlement.label,
      readiness: settlement.readiness,
    },
    accounting: {
      state: accounting.state,
      label: accounting.label,
      exportModel: accounting.exportModel,
    },
  };
}

export function deriveProjectWorkflows(context: ProjectWorkflowContext): ProjectWorkflowBundle {
  const inputContext: ParticipantWorkflowInputContext = {
    projectId: context.projectId,
    projectName: context.projectName,
  };

  return {
    projectId: context.projectId,
    participants: context.participants.map((participant) =>
      deriveParticipantWorkflows(participant, inputContext)
    ),
  };
}

export function deriveParticipantWorkflowBadges(
  participant: DemoParticipant,
  context: ParticipantWorkflowInputContext = {}
): ParticipantWorkflowBadges {
  const workflows = deriveParticipantWorkflows(participant, context);
  return {
    commercialStatus: workflows.commercial.label,
    settlementStatus: workflows.settlement.label,
    accountingStatus: workflows.accounting.label,
  };
}
