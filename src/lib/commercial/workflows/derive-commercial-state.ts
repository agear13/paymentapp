/**
 * Commercial Workflow — agreement and commercial execution lifecycle.
 *
 * Does NOT depend on accounting exports or settlement execution.
 */
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { deriveAgreementLifecycleState } from '@/lib/operations/lifecycle/agreement-lifecycle';
import { isParticipantEarningsConfigured } from '@/lib/operations/selectors/participant-earnings-selectors';
import {
  hasApprovedAgreement,
  isParticipantCompensationExempt,
} from '@/lib/operations/primitives/participant-earnings-primitives';
import {
  hasParticipantIdentityReady,
  isPaymentRequestSent,
} from '@/lib/commercial/participant-lifecycle-primitives';
import {
  supplierLifecycleForParticipant,
} from '@/lib/commercial/workflows/build-participant-workflow-inputs';
import {
  COMMERCIAL_WORKFLOW_LABELS,
  type CommercialWorkflowState,
  type ProjectWorkflowContext,
} from '@/lib/commercial/workflows/types';

export type CommercialWorkflowResult = {
  state: CommercialWorkflowState;
  label: string;
};

function isAgreementSent(participant: DemoParticipant): boolean {
  if (hasApprovedAgreement(participant)) return false;
  const agreement = deriveAgreementLifecycleState(participant);
  if (agreement === 'SHARED' || agreement === 'VIEWED' || agreement === 'SIGNED') return true;
  if (participant.inviteSentAt || participant.agreementSharedAt) return true;
  if (participant.agreementViewedAt) return true;
  return false;
}

function hasOutstandingCommercialObligations(participant: DemoParticipant): boolean {
  const deps = participant.extractedObligations?.commercialDependencies ?? [];
  if (deps.some((d) => d.blocksSettlement)) return true;

  const conditionals = participant.extractedObligations?.conditionalPayments ?? [];
  if (conditionals.some((c) => c.trigger?.trim() && !c.amount)) return true;

  return false;
}

/**
 * Derive commercial workflow state for a single participant.
 */
export function deriveParticipantCommercialWorkflowState(
  participant: DemoParticipant
): CommercialWorkflowResult {
  const identityReady = hasParticipantIdentityReady(participant);
  const earningsReady =
    isParticipantCompensationExempt(participant) || isParticipantEarningsConfigured(participant);

  if (!identityReady || !earningsReady) {
    return { state: 'INVITED', label: COMMERCIAL_WORKFLOW_LABELS.INVITED };
  }

  if (!hasApprovedAgreement(participant)) {
    if (isAgreementSent(participant)) {
      return {
        state: 'AGREEMENT_PENDING',
        label: COMMERCIAL_WORKFLOW_LABELS.AGREEMENT_PENDING,
      };
    }
    return { state: 'INVITED', label: COMMERCIAL_WORKFLOW_LABELS.INVITED };
  }

  if (participant.payoutSettlementStatus === 'Paid' || participant.payoutPaidAt) {
    return {
      state: 'COMMERCIALLY_COMPLETE',
      label: COMMERCIAL_WORKFLOW_LABELS.COMMERCIALLY_COMPLETE,
    };
  }

  const supplier = supplierLifecycleForParticipant(participant);

  if (isParticipantCompensationExempt(participant)) {
    if (supplier === 'APPROVED') {
      return {
        state: 'COMMERCIAL_SETTLEMENT_READY',
        label: COMMERCIAL_WORKFLOW_LABELS.COMMERCIAL_SETTLEMENT_READY,
      };
    }
    return {
      state: 'AGREEMENT_ACCEPTED',
      label: COMMERCIAL_WORKFLOW_LABELS.AGREEMENT_ACCEPTED,
    };
  }

  if (!isPaymentRequestSent(participant)) {
    return {
      state: 'AGREEMENT_ACCEPTED',
      label: COMMERCIAL_WORKFLOW_LABELS.AGREEMENT_ACCEPTED,
    };
  }

  if (supplier === 'APPROVED') {
    return {
      state: 'COMMERCIAL_SETTLEMENT_READY',
      label: COMMERCIAL_WORKFLOW_LABELS.COMMERCIAL_SETTLEMENT_READY,
    };
  }

  if (hasOutstandingCommercialObligations(participant)) {
    return {
      state: 'OBLIGATIONS_OUTSTANDING',
      label: COMMERCIAL_WORKFLOW_LABELS.OBLIGATIONS_OUTSTANDING,
    };
  }

  return {
    state: 'COMMERCIALLY_ACTIVE',
    label: COMMERCIAL_WORKFLOW_LABELS.COMMERCIALLY_ACTIVE,
  };
}

/** Derive commercial workflow states for all participants in a project. */
export function deriveCommercialState(
  context: ProjectWorkflowContext
): CommercialWorkflowResult[] {
  return context.participants.map((participant) =>
    deriveParticipantCommercialWorkflowState(participant)
  );
}
