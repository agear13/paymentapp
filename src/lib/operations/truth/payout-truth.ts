import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  derivePayoutOnboardingPhase,
} from '@/lib/operations/lifecycle/payout-lifecycle';
import { payoutOnboardingPlaceholderCopy } from '@/lib/operations/lifecycle/payout-lifecycle';
import { hasPersistedPayoutReadyForKpi } from '@/lib/operations/primitives/participant-earnings-primitives';

export function isParticipantPayoutReady(participant: DemoParticipant): boolean {
  return hasPersistedPayoutReadyForKpi(participant);
}

export function payoutDestinationTruthMessage(participant: DemoParticipant): string {
  if (
    participant.payoutVerificationConfirmed === true ||
    participant.payoutOnboardingPhase === 'COMPLETED' ||
    participant.onboardingStatus === 'COMPLETE'
  ) {
    return 'Supplier onboarding complete';
  }
  return payoutOnboardingPlaceholderCopy(derivePayoutOnboardingPhase(participant));
}

export function shouldShowPayoutDestinationBlocker(_participant: DemoParticipant): boolean {
  return false;
}
