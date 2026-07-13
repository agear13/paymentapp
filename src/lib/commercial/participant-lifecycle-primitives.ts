/**
 * Shared participant lifecycle primitives used by workflow derivation modules.
 */
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { hasApprovedAgreement } from '@/lib/operations/primitives/participant-earnings-primitives';
import {
  deriveLifecycle,
  type StoredOnboardingState,
} from '@/lib/commercial/supplier-onboarding-domain';

export function hasParticipantIdentityReady(participant: DemoParticipant): boolean {
  return Boolean(participant.id?.trim() && participant.role?.trim());
}

export function isSettlementPaid(participant: DemoParticipant): boolean {
  return participant.payoutSettlementStatus === 'Paid' || Boolean(participant.payoutPaidAt);
}

export function supplierLifecycle(participant: DemoParticipant) {
  const stored = participant.supplierOnboarding as StoredOnboardingState | undefined;
  return deriveLifecycle(stored, {
    payoutVerificationConfirmed: participant.payoutVerificationConfirmed,
    payoutOnboardingPhase: participant.payoutOnboardingPhase,
    onboardingStatus: participant.onboardingStatus,
  });
}

/** Operator generated and shared the payment & tax portal with the participant. */
export function isPaymentRequestSent(participant: DemoParticipant): boolean {
  if (participant.paymentSetup?.paymentRequestGeneratedAt) return true;
  if (!hasApprovedAgreement(participant)) return false;
  return supplierLifecycle(participant) !== 'NOT_STARTED';
}

export function isXeroExported(participant: DemoParticipant): boolean {
  const ps = participant.paymentSetup;
  return Boolean(ps?.xeroExportedAt && ps?.xeroSyncStatus === 'synced');
}
