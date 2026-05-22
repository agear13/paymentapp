import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  derivePayoutOnboardingPhase,
  PAYOUT_ONBOARDING_UI_IMPLEMENTED,
  payoutOnboardingPlaceholderCopy,
} from '@/lib/operations/lifecycle/payout-lifecycle';
import { isParticipantOperationallyApproved } from '@/lib/operations/truth/participant-truth';
import { isOnboardingComplete } from '@/lib/deal-network-demo/participant-onboarding';

export function isParticipantPayoutReady(participant: DemoParticipant): boolean {
  if (participant.payoutBlocked) return false;
  if (!isParticipantOperationallyApproved(participant)) return false;
  if (participant.compensationProfile?.exemptFromPayout) return true;
  if (!participant.compensationProfile?.configured) return false;
  if (!PAYOUT_ONBOARDING_UI_IMPLEMENTED) {
    return isOnboardingComplete(participant.onboardingStatus ?? 'NOT_STARTED');
  }
  return derivePayoutOnboardingPhase(participant) === 'COMPLETED';
}

export function payoutDestinationTruthMessage(participant: DemoParticipant): string {
  if (!PAYOUT_ONBOARDING_UI_IMPLEMENTED) {
    return payoutOnboardingPlaceholderCopy(derivePayoutOnboardingPhase(participant));
  }
  if (!participant.email?.trim()) {
    return 'Payout destination not configured';
  }
  return payoutOnboardingPlaceholderCopy(derivePayoutOnboardingPhase(participant));
}

export function shouldShowPayoutDestinationBlocker(participant: DemoParticipant): boolean {
  return PAYOUT_ONBOARDING_UI_IMPLEMENTED && !participant.email?.trim();
}
