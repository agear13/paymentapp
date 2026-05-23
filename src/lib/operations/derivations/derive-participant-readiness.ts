import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { deriveParticipantPayoutReadiness } from '@/lib/operations/readiness/participant-readiness';
import { deriveAgreementLifecycleState } from '@/lib/operations/lifecycle/agreement-lifecycle';
import { AGREEMENT_LIFECYCLE_STATES } from '@/lib/operations/lifecycle/agreement-lifecycle';

export type DerivedParticipantOperationalState = {
  payoutReady: boolean;
  agreementReady: boolean;
  needsAttention: boolean;
  primaryIssue: string | null;
  issues: string[];
};

const AGREEMENT_READY_STATES = new Set<string>(['SIGNED', 'APPROVED', 'VIEWED']);

/** Pure participant readiness — no UI logic. */
export function deriveParticipantReadiness(
  participant: DemoParticipant,
  context?: { providerConnected?: boolean; obligationsLinked?: boolean }
): DerivedParticipantOperationalState {
  const readiness = deriveParticipantPayoutReadiness(participant, context);
  const agreement = deriveAgreementLifecycleState(participant);
  const agreementReady = AGREEMENT_READY_STATES.has(agreement);

  return {
    payoutReady: readiness.payoutReady,
    agreementReady,
    needsAttention: !readiness.payoutReady || readiness.issues.length > 0,
    primaryIssue: readiness.primaryIssue,
    issues: readiness.issues,
  };
}

export { AGREEMENT_LIFECYCLE_STATES };
