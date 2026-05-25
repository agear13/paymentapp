import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { OperationalAttributionContract } from '@/lib/operations/contracts/attribution-contract';
import { deriveAttributionLifecycleState } from '@/lib/operations/lifecycle/attribution-lifecycle';
import type { CommissionScopeContext } from '@/lib/operations/truth/attribution-eligibility';
import {
  canGenerateAttributionLink,
  isAttributionActiveForTracking,
} from '@/lib/operations/truth/attribution-truth';

/** Pure attribution operational state — no UI logic. */
export function deriveAttributionState(
  participant: DemoParticipant,
  context: CommissionScopeContext = {}
): OperationalAttributionContract {
  const lifecycle = deriveAttributionLifecycleState(participant, context);
  const enabled = canGenerateAttributionLink(participant, context);
  const active = enabled && isAttributionActiveForTracking(participant, context);
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
