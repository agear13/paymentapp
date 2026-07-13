/**
 * Participant Commercial Workspace — canonical lifecycle state.
 *
 * Derived from independent commercial and settlement workflows.
 * Do not persist separately — single source of truth remains participant payload.
 */
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { hasApprovedAgreement } from '@/lib/operations/primitives/participant-earnings-primitives';
import { deriveParticipantWorkflows } from '@/lib/commercial/workflows/derive-participant-workflows';

export const PARTICIPANT_COMMERCIAL_STATES = [
  'INVITED',
  'AGREEMENT_PENDING',
  'AGREEMENT_ACCEPTED',
  'ACTIVE',
  'SETTLEMENT_PENDING',
  'PAID',
] as const;

export type ParticipantCommercialState = (typeof PARTICIPANT_COMMERCIAL_STATES)[number];

export const PARTICIPANT_COMMERCIAL_STATE_LABELS: Record<ParticipantCommercialState, string> = {
  INVITED: 'Invited',
  AGREEMENT_PENDING: 'Agreement pending',
  AGREEMENT_ACCEPTED: 'Agreement accepted',
  ACTIVE: 'Commercially active',
  SETTLEMENT_PENDING: 'Settlement pending',
  PAID: 'Paid',
};

/**
 * Derive the participant-facing commercial state from independent workflows.
 */
export function deriveParticipantCommercialState(
  participant: DemoParticipant
): ParticipantCommercialState {
  const workflows = deriveParticipantWorkflows(participant);

  if (
    workflows.settlement.state === 'COMPLETE' ||
    participant.payoutSettlementStatus === 'Paid'
  ) {
    return 'PAID';
  }

  if (
    workflows.settlement.state === 'READY' ||
    workflows.settlement.state === 'INITIATED' ||
    workflows.settlement.state === 'PROCESSING'
  ) {
    return 'SETTLEMENT_PENDING';
  }

  if (!hasApprovedAgreement(participant)) {
    if (workflows.commercial.state === 'AGREEMENT_PENDING') {
      return 'AGREEMENT_PENDING';
    }
    if (participant.agreementSharedAt || participant.inviteSentAt) {
      return 'AGREEMENT_PENDING';
    }
    return 'INVITED';
  }

  if (workflows.commercial.state === 'AGREEMENT_ACCEPTED') {
    return 'AGREEMENT_ACCEPTED';
  }

  if (
    workflows.commercial.state === 'COMMERCIALLY_ACTIVE' ||
    workflows.commercial.state === 'OBLIGATIONS_OUTSTANDING' ||
    workflows.commercial.state === 'COMMERCIAL_SETTLEMENT_READY'
  ) {
    return 'ACTIVE';
  }

  if (workflows.commercial.state === 'COMMERCIALLY_COMPLETE') {
    return 'PAID';
  }

  return 'AGREEMENT_ACCEPTED';
}

/** Participant must review and approve their agreement inside the workspace. */
export function needsWorkspaceAgreementApproval(state: ParticipantCommercialState): boolean {
  return state === 'AGREEMENT_PENDING';
}

/** Participant is waiting for the organiser to send the agreement. */
export function isWorkspaceAwaitingAgreementSend(state: ParticipantCommercialState): boolean {
  return state === 'INVITED';
}

/** Show the full commercial workspace (post-agreement or terminal states). */
export function showsCommercialWorkspace(state: ParticipantCommercialState): boolean {
  return !needsWorkspaceAgreementApproval(state) && !isWorkspaceAwaitingAgreementSend(state);
}

export type ParticipantWorkspaceExperience = 'awaiting_send' | 'agreement_review' | 'commercial';

export function deriveParticipantWorkspaceExperience(
  state: ParticipantCommercialState
): ParticipantWorkspaceExperience {
  if (isWorkspaceAwaitingAgreementSend(state)) return 'awaiting_send';
  if (needsWorkspaceAgreementApproval(state)) return 'agreement_review';
  return 'commercial';
}
