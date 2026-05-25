import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  canGenerateAttributionLink,
  type CommissionScopeContext,
} from '@/lib/operations/truth/attribution-eligibility';

export const ATTRIBUTION_LIFECYCLE_STATES = [
  'NOT_ENABLED',
  'ELIGIBLE',
  'LINK_GENERATED',
  'ACTIVE',
  'DISABLED',
] as const;

export type AttributionLifecycleState = (typeof ATTRIBUTION_LIFECYCLE_STATES)[number];

export const ATTRIBUTION_LIFECYCLE_TRANSITIONS: Record<
  AttributionLifecycleState,
  readonly AttributionLifecycleState[]
> = {
  NOT_ENABLED: ['DISABLED'],
  ELIGIBLE: ['LINK_GENERATED', 'NOT_ENABLED'],
  LINK_GENERATED: ['ACTIVE', 'ELIGIBLE'],
  ACTIVE: ['DISABLED', 'LINK_GENERATED'],
  DISABLED: ['NOT_ENABLED', 'ELIGIBLE'],
};

export const ATTRIBUTION_LIFECYCLE_LABELS: Record<AttributionLifecycleState, string> = {
  NOT_ENABLED: 'Attribution not enabled',
  ELIGIBLE: 'Attribution eligible',
  LINK_GENERATED: 'Attribution link ready',
  ACTIVE: 'Attribution active',
  DISABLED: 'Attribution disabled',
};

export const ATTRIBUTION_LIFECYCLE_MEANING: Record<AttributionLifecycleState, string> = {
  NOT_ENABLED: 'This participant does not earn from customer purchases.',
  ELIGIBLE: 'Customer attribution is configured; link not yet issued.',
  LINK_GENERATED: 'Trackable link exists; awaiting approval or activation.',
  ACTIVE: 'Customer purchase attribution is active.',
  DISABLED: 'Attribution was disabled for this participant.',
};

export function deriveAttributionLifecycleState(
  participant: DemoParticipant,
  context: CommissionScopeContext = {}
): AttributionLifecycleState {
  if (participant.attributionLifecycle) {
    return participant.attributionLifecycle;
  }
  if (!canGenerateAttributionLink(participant, context)) return 'NOT_ENABLED';
  if (
    participant.customerCommerceUrl?.trim() ||
    participant.inviteLink?.trim() ||
    participant.attributionStatus === 'active'
  ) {
    return participant.approvalStatus === 'Approved' ? 'ACTIVE' : 'LINK_GENERATED';
  }
  return 'ELIGIBLE';
}

export function canTransitionAttributionLifecycle(
  from: AttributionLifecycleState,
  to: AttributionLifecycleState
): boolean {
  if (from === to) return true;
  return ATTRIBUTION_LIFECYCLE_TRANSITIONS[from]?.includes(to) ?? false;
}

export const ATTRIBUTION_DISABLED_COPY =
  'This participant does not earn from customer purchases.';
