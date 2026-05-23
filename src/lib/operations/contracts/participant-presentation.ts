import type { AgreementLifecycleState } from '@/lib/operations/lifecycle/agreement-lifecycle';
import { AGREEMENT_LIFECYCLE_LABELS } from '@/lib/operations/lifecycle/agreement-lifecycle';
import type { AttributionLifecycleState } from '@/lib/operations/lifecycle/attribution-lifecycle';
import { ATTRIBUTION_LIFECYCLE_LABELS } from '@/lib/operations/lifecycle/attribution-lifecycle';
import type { PayoutOnboardingPhase } from '@/lib/operations/lifecycle/payout-lifecycle';
import type { HydratedParticipant } from '@/lib/operations/contracts/participant-contract';

/** Contract-driven display labels — no inline lifecycle inference in components. */
export function agreementLabelFromContract(agreement: AgreementLifecycleState): string {
  return AGREEMENT_LIFECYCLE_LABELS[agreement] ?? 'Agreement';
}

export function attributionLabelFromContract(
  lifecycle: AttributionLifecycleState,
  enabled: boolean
): string {
  if (!enabled) return ATTRIBUTION_LIFECYCLE_LABELS.NOT_ENABLED;
  return ATTRIBUTION_LIFECYCLE_LABELS[lifecycle] ?? 'Attribution';
}

export function payoutVerificationLabelFromContract(
  _phase: PayoutOnboardingPhase,
  verified: boolean,
  blocked = false
): string {
  if (blocked) return 'Blocked';
  if (verified) return 'Confirmed';
  return 'Not confirmed';
}

export function participantDisplayName(hydrated: HydratedParticipant): string {
  return hydrated.identity.displayName;
}

export function participantEmail(hydrated: HydratedParticipant): string {
  return hydrated.identity.email?.trim() || 'No email';
}
