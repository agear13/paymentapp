import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  derivePayoutOnboardingPhase,
} from '@/lib/operations/lifecycle/payout-lifecycle';
import { isParticipantOperationallyApproved } from '@/lib/operations/truth/participant-truth';
import { payoutOnboardingPlaceholderCopy } from '@/lib/operations/lifecycle/payout-lifecycle';
import { isParticipantEarningsConfigured } from '@/lib/operations/selectors/participant-earnings-selectors';

export function isParticipantPayoutReady(participant: DemoParticipant): boolean {
  if (participant.payoutBlocked) return false;
  if (!isParticipantOperationallyApproved(participant)) return false;
  if (participant.compensationProfile?.exemptFromPayout) return true;
  if (!isParticipantEarningsConfigured(participant)) return false;
  return participant.payoutVerificationConfirmed === true;
}

export function payoutDestinationTruthMessage(participant: DemoParticipant): string {
  if (participant.payoutVerificationConfirmed === true) {
    return 'Payout details confirmed externally';
  }
  return payoutOnboardingPlaceholderCopy(derivePayoutOnboardingPhase(participant));
}

export function shouldShowPayoutDestinationBlocker(_participant: DemoParticipant): boolean {
  return false;
}
