import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  ATTRIBUTION_DISABLED_COPY,
  deriveAttributionLifecycleState,
} from '@/lib/operations/lifecycle/attribution-lifecycle';

export function canGenerateAttributionLink(participant: DemoParticipant): boolean {
  if (participant.compensationProfile?.customerAttributionEnabled === true) {
    return true;
  }
  if (participant.participationModel === 'customer_attribution') {
    return participant.compensationProfile?.configured === true;
  }
  return false;
}

export function isAttributionOperationallyEnabled(participant: DemoParticipant): boolean {
  if (!canGenerateAttributionLink(participant)) return false;
  const state = deriveAttributionLifecycleState(participant);
  return state === 'ACTIVE' || state === 'LINK_GENERATED';
}

export function isAttributionActiveForTracking(participant: DemoParticipant): boolean {
  if (!canGenerateAttributionLink(participant)) return false;
  return (
    participant.approvalStatus === 'Approved' &&
    (participant.attributionStatus === 'active' ||
      Boolean(participant.customerCommerceUrl?.trim()))
  );
}

export function attributionTruthLabel(participant: DemoParticipant): string {
  if (!canGenerateAttributionLink(participant)) {
    return ATTRIBUTION_DISABLED_COPY;
  }
  const state = deriveAttributionLifecycleState(participant);
  if (state === 'ACTIVE') return 'Attribution active';
  if (state === 'LINK_GENERATED') return 'Attribution link ready';
  return 'Attribution eligible — pending approval';
}

export { ATTRIBUTION_DISABLED_COPY };
