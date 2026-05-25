import type { AgreementLifecycleState } from '@/lib/operations/lifecycle/agreement-lifecycle';
import { AGREEMENT_LIFECYCLE_LABELS } from '@/lib/operations/lifecycle/agreement-lifecycle';
import type { AttributionLifecycleState } from '@/lib/operations/lifecycle/attribution-lifecycle';
import { ATTRIBUTION_LIFECYCLE_LABELS } from '@/lib/operations/lifecycle/attribution-lifecycle';
import type { PayoutOnboardingPhase } from '@/lib/operations/lifecycle/payout-lifecycle';
import type { HydratedParticipant } from '@/lib/operations/contracts/participant-contract';

const AGREEMENT_SECONDARY: Record<AgreementLifecycleState, string> = {
  NOT_CREATED: 'Ready to send to participant',
  DRAFTED: 'Finalize agreement before sharing',
  GENERATED: 'Ready to send to participant',
  SHARED: 'Awaiting participant review',
  VIEWED: 'Awaiting participant review',
  SIGNED: 'Awaiting operator approval',
  APPROVED: 'Agreement complete',
};

const ATTRIBUTION_CHIP: Record<AttributionLifecycleState, string> = {
  NOT_ENABLED: 'Inactive',
  ELIGIBLE: 'Eligible',
  LINK_GENERATED: 'Ready',
  ACTIVE: 'Active',
  DISABLED: 'Disabled',
};

const ATTRIBUTION_SECONDARY: Record<AttributionLifecycleState, string> = {
  NOT_ENABLED: 'Attribution not enabled',
  ELIGIBLE: 'Configure in earnings settings',
  LINK_GENERATED: 'Link ready — pending activation',
  ACTIVE: 'Customer tracking enabled',
  DISABLED: 'Attribution turned off',
};

/** Contract-driven display labels — no inline lifecycle inference in components. */
export function agreementLabelFromContract(agreement: AgreementLifecycleState): string {
  return AGREEMENT_LIFECYCLE_LABELS[agreement] ?? 'Agreement';
}

export function agreementSecondaryFromContract(agreement: AgreementLifecycleState): string {
  return AGREEMENT_SECONDARY[agreement] ?? 'Agreement status';
}

export function attributionChipLabelFromContract(
  lifecycle: AttributionLifecycleState,
  enabled: boolean
): string {
  if (!enabled) return 'Inactive';
  return ATTRIBUTION_CHIP[lifecycle] ?? 'Attribution';
}

export function attributionLabelFromContract(
  lifecycle: AttributionLifecycleState,
  enabled: boolean
): string {
  if (!enabled) return ATTRIBUTION_LIFECYCLE_LABELS.NOT_ENABLED;
  return ATTRIBUTION_LIFECYCLE_LABELS[lifecycle] ?? 'Attribution';
}

export function attributionSecondaryFromContract(
  lifecycle: AttributionLifecycleState,
  enabled: boolean
): string {
  if (!enabled) return 'Attribution not enabled';
  return ATTRIBUTION_SECONDARY[lifecycle] ?? 'Attribution status';
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

export function participantApprovalNoteSecondary(hydrated: HydratedParticipant): string | null {
  const note = hydrated._entity.approvalNote?.trim();
  if (!note) return null;
  return `Participant note: ${note}`;
}

export function agreementSecondaryWithNote(hydrated: HydratedParticipant): string {
  const base = agreementSecondaryFromContract(hydrated.lifecycle.agreement);
  const note = participantApprovalNoteSecondary(hydrated);
  return note ? `${base} · ${note}` : base;
}
