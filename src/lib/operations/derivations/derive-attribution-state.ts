import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { OperationalAttributionContract } from '@/lib/operations/contracts/attribution-contract';
import { deriveAttributionLifecycleState } from '@/lib/operations/lifecycle/attribution-lifecycle';
import {
  canGenerateAttributionLink,
  isAttributionActiveForTracking,
} from '@/lib/operations/truth/attribution-truth';

/** Pure attribution operational state — no UI logic. */
export function deriveAttributionState(
  participant: DemoParticipant
): OperationalAttributionContract {
  const lifecycle = deriveAttributionLifecycleState(participant);
  const enabled = canGenerateAttributionLink(participant);
  const active = enabled && isAttributionActiveForTracking(participant);
  const linkGenerated =
    lifecycle === 'LINK_GENERATED' ||
    lifecycle === 'ACTIVE' ||
    Boolean(participant.customerCommerceUrl?.trim()) ||
    Boolean(participant.inviteLink?.trim());

  return {
    enabled,
    active,
    linkGenerated,
    lifecycle,
  };
}
