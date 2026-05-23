import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { deriveCompensationReadiness } from '@/lib/operations/readiness/compensation-readiness';
import { deriveAgreementLifecycleState } from '@/lib/operations/lifecycle/agreement-lifecycle';
import { isParticipantPayoutReady } from '@/lib/operations/truth/payout-truth';
import { projectParticipantsPath } from '@/lib/projects/project-routes';
import { normalizeParticipantEntity } from '@/lib/operations/guards/hydration-guards';

export type OperationalBlocker = {
  participantId: string;
  participantName: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
};

export function deriveParticipantPayoutBlockers(
  participant: DemoParticipant,
  projectId?: string
): OperationalBlocker[] {
  const p = normalizeParticipantEntity(participant);
  if (isParticipantPayoutReady(p)) return [];

  const reviewHref = projectId
    ? `${projectParticipantsPath(projectId)}?participant=${encodeURIComponent(p.id)}`
    : '#';

  const blockers: OperationalBlocker[] = [];
  const agreementApproved = deriveAgreementLifecycleState(p) === 'APPROVED';

  const comp = deriveCompensationReadiness(p);
  if (comp.missingRequirements.length > 0) {
    blockers.push({
      participantId: p.id,
      participantName: p.name,
      title: 'Compensation not configured',
      description: 'Earnings structure must be saved before payout readiness can be assessed.',
      ctaLabel: 'Review participant',
      ctaHref: reviewHref,
    });
  }

  if (!agreementApproved && !p.compensationProfile?.exemptFromPayout) {
    blockers.push({
      participantId: p.id,
      participantName: p.name,
      title: 'Agreement not approved',
      description: 'The participant has not yet approved their participation agreement.',
      ctaLabel: 'Review participant',
      ctaHref: reviewHref,
    });
  }

  if (
    agreementApproved &&
    !p.compensationProfile?.exemptFromPayout &&
    p.payoutVerificationConfirmed !== true
  ) {
    blockers.push({
      participantId: p.id,
      participantName: p.name,
      title: 'Payout details not confirmed',
      description:
        'The operator has not yet confirmed this participant’s external payout details.',
      ctaLabel: 'Review participant',
      ctaHref: reviewHref,
    });
  }

  if (p.payoutBlocked) {
    blockers.push({
      participantId: p.id,
      participantName: p.name,
      title: 'Payout release blocked',
      description: 'This participant is flagged as blocked from payout release by the operator.',
      ctaLabel: 'Review participant',
      ctaHref: reviewHref,
    });
  }

  return blockers;
}
