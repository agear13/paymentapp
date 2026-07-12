/**
 * Participant-facing settlement explanation.
 *
 * Reuses canonical workflow derivation and obligation state — no duplicate logic.
 */
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { deriveParticipantOperationalWorkflow } from '@/lib/commercial/participant-commercial-lifecycle';
import { hasApprovedAgreement } from '@/lib/operations/primitives/participant-earnings-primitives';
import type {
  PortalObligationSnapshot,
  SettlementExplanation,
} from '@/lib/participant-portal/participant-portal-types';

function obligationBlockingReason(
  obligations: PortalObligationSnapshot[]
): string | null {
  const unfunded = obligations.filter((o) =>
    ['UNFUNDED', 'PARTIALLY_FUNDED', 'DRAFT'].includes(o.status.toUpperCase())
  );
  if (unfunded.length > 0) {
    return 'Waiting for event reconciliation or project funding.';
  }

  const pendingApproval = obligations.filter((o) =>
    o.status.toUpperCase() === 'PENDING_APPROVAL'
  );
  if (pendingApproval.length > 0) {
    return 'Waiting for organiser approval.';
  }

  return null;
}

function extractedBlockingReason(participant: DemoParticipant): string | null {
  const deps = participant.extractedObligations?.commercialDependencies ?? [];
  const blocker = deps.find((d) => d.blocksSettlement && d.description?.trim());
  if (blocker?.description?.trim()) {
    return blocker.description.trim();
  }

  const conditional = participant.extractedObligations?.conditionalPayments?.[0];
  if (conditional?.trigger?.trim()) {
    return `Waiting for milestone completion: ${conditional.trigger.trim()}.`;
  }

  const settlementEvent = participant.extractedObligations?.settlementEvents?.find(
    (e) => e.condition?.trim() || e.trigger?.trim()
  );
  if (settlementEvent?.condition?.trim()) {
    return `Waiting for revenue confirmation: ${settlementEvent.condition.trim()}.`;
  }
  if (settlementEvent?.trigger?.trim()) {
    return settlementEvent.trigger.trim();
  }

  return null;
}

export function deriveParticipantSettlementExplanation(
  participant: DemoParticipant,
  obligations: PortalObligationSnapshot[]
): SettlementExplanation {
  const workflow = deriveParticipantOperationalWorkflow(participant);
  const obligationReason = obligationBlockingReason(obligations);
  const extractedReason = extractedBlockingReason(participant);

  let statusLabel = workflow.badge;
  let blockingReason: string | null = null;
  let nextStep = workflow.explanation;
  let isBlocked = workflow.readiness === 'blocked';

  if (!hasApprovedAgreement(participant)) {
    statusLabel = 'Awaiting agreement acceptance';
    blockingReason = 'Your commercial agreement has not been accepted yet.';
    nextStep = 'Review and accept the agreement sent by the organiser.';
    isBlocked = true;
  } else if (participant.payoutSettlementStatus === 'Paid' || workflow.stage === 'PAID') {
    statusLabel = 'Payment released';
    blockingReason = null;
    nextStep = 'Settlement has been completed.';
    isBlocked = false;
  } else if (workflow.stage === 'SETTLEMENT_READY') {
    statusLabel = 'Ready for settlement';
    nextStep = 'Payment will be released once the organiser completes the settlement run.';
    isBlocked = false;
  } else if (obligationReason) {
    blockingReason = obligationReason;
    isBlocked = true;
  } else if (extractedReason) {
    blockingReason = extractedReason;
    isBlocked = true;
  } else if (workflow.readiness === 'waiting') {
    blockingReason = workflow.explanation;
    isBlocked = false;
  } else if (workflow.integrityIssues.length > 0) {
    blockingReason = workflow.integrityIssues[0]?.message ?? null;
  }

  if (participant.payoutCondition?.trim() && !blockingReason && workflow.readiness !== 'complete') {
    const condition = participant.payoutCondition.trim();
    if (/sponsor|reconcil|milestone|attendance|confirm/i.test(condition)) {
      blockingReason = condition;
    }
  }

  return {
    statusLabel,
    blockingReason,
    nextStep,
    isBlocked,
  };
}
