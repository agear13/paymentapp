import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { OperationalBlockerDetail } from '@/lib/operations/contracts/approval-state';
import { deriveOperationalBlocker } from '@/lib/operations/derivations/derive-approval-state';
import { isParticipantPayoutReady } from '@/lib/operations/truth/payout-truth';
import { normalizeParticipantEntity } from '@/lib/operations/guards/hydration-guards';

/** @deprecated Use OperationalBlockerDetail from approval-state contract */
export type OperationalBlocker = {
  participantId: string;
  participantName: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  owner?: string;
  requiredAction?: string;
  unlocks?: string;
};

function toLegacyBlocker(detail: OperationalBlockerDetail): OperationalBlocker {
  return {
    participantId: detail.participantId ?? 'unknown',
    participantName: detail.participantName ?? 'Participant',
    title: detail.requiredAction,
    description: detail.explanation,
    ctaLabel: detail.ctaLabel ?? 'Review',
    ctaHref: detail.resolutionRoute,
    owner: detail.ownerLabel,
    requiredAction: detail.requiredAction,
    unlocks: detail.unlocks,
  };
}

export function deriveParticipantOperationalBlockers(
  participant: DemoParticipant,
  projectId?: string
): OperationalBlockerDetail[] {
  const p = normalizeParticipantEntity(participant);
  if (isParticipantPayoutReady(p)) return [];
  return deriveOperationalBlocker(p, projectId);
}

export function deriveParticipantPayoutBlockers(
  participant: DemoParticipant,
  projectId?: string
): OperationalBlocker[] {
  return deriveParticipantOperationalBlockers(participant, projectId).map(toLegacyBlocker);
}
