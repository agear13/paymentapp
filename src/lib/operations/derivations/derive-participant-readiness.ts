import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { deriveParticipantPayoutReadiness } from '@/lib/operations/readiness/participant-readiness';
import { AGREEMENT_LIFECYCLE_STATES } from '@/lib/operations/lifecycle/agreement-lifecycle';
import { deriveAgreementApprovalState } from '@/lib/operations/derivations/derive-approval-state';

export type DerivedParticipantOperationalState = {
  payoutReady: boolean;
  agreementReady: boolean;
  needsAttention: boolean;
  primaryIssue: string | null;
  issues: string[];
};

/** Pure participant readiness — no UI logic. */
export function deriveParticipantReadiness(
  participant: DemoParticipant,
  context?: { providerConnected?: boolean; obligationsLinked?: boolean }
): DerivedParticipantOperationalState {
  const readiness = deriveParticipantPayoutReadiness(participant, context);
  const agreementState = deriveAgreementApprovalState(participant);
  const agreementReady =
    agreementState === 'participant_approved' || agreementState === 'fully_approved';

  return {
    payoutReady: readiness.payoutReady,
    agreementReady,
    needsAttention: !readiness.payoutReady || readiness.issues.length > 0,
    primaryIssue: readiness.primaryIssue,
    issues: readiness.issues,
  };
}

export { AGREEMENT_LIFECYCLE_STATES };
