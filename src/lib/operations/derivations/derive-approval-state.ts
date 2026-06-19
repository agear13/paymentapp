import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type {
  AgreementApprovalState,
  ApprovalActor,
  ApprovalOwnership,
  ObligationApprovalState,
  OperationalBlockerDetail,
  OperationalBlockerSeverity,
} from '@/lib/operations/contracts/approval-state';
import { deriveCompensationReadiness } from '@/lib/operations/readiness/compensation-readiness';
import { deriveAgreementLifecycleState } from '@/lib/operations/lifecycle/agreement-lifecycle';
import { normalizeParticipantEntity } from '@/lib/operations/guards/hydration-guards';
import { projectParticipantsPath } from '@/lib/projects/project-routes';
import { isParticipantPayoutReady } from '@/lib/operations/truth/payout-truth';

const SHARED_AGREEMENT_STATES = new Set(['SHARED', 'VIEWED', 'SIGNED', 'GENERATED']);

/** Canonical agreement approval state — persisted approval takes precedence. */
export function deriveAgreementApprovalState(
  participant: DemoParticipant
): AgreementApprovalState {
  const p = normalizeParticipantEntity(participant);
  const persistedApproved = p.approvalStatus === 'Approved';
  const operatorConfirmed = p.payoutVerificationConfirmed === true;

  if (persistedApproved && operatorConfirmed) return 'fully_approved';
  if (persistedApproved) return 'participant_approved';
  if (operatorConfirmed) return 'operator_confirmed';

  const lifecycle = deriveAgreementLifecycleState(p);
  if (lifecycle === 'APPROVED') return 'participant_approved';
  if (SHARED_AGREEMENT_STATES.has(lifecycle)) return 'shared';
  return 'draft';
}

export function deriveObligationApprovalState(input: {
  obligationStatus: string;
  participant?: DemoParticipant | null;
}): ObligationApprovalState {
  const { obligationStatus, participant } = input;
  const status = obligationStatus.toUpperCase();

  if (status === 'REJECTED' || status === 'REVERSED') return 'blocked';
  if (status === 'AVAILABLE_FOR_PAYOUT' || status === 'PAID') return 'ready';
  if (status === 'UNFUNDED' || status === 'PARTIALLY_FUNDED' || status === 'DRAFT') {
    return 'blocked';
  }

  if (status === 'PENDING_APPROVAL') {
    if (!participant) return 'pending_participant';
    const agreement = deriveAgreementApprovalState(participant);
    if (agreement === 'fully_approved' && isParticipantPayoutReady(participant)) {
      return 'ready';
    }
    if (agreement === 'participant_approved' || agreement === 'operator_confirmed') {
      return 'pending_operator';
    }
    return 'pending_participant';
  }

  if (status === 'APPROVED' && participant) {
    const agreement = deriveAgreementApprovalState(participant);
    if (agreement === 'draft' || agreement === 'shared') return 'pending_participant';
    if (agreement === 'participant_approved' && participant.payoutVerificationConfirmed !== true) {
      return 'pending_operator';
    }
    return 'ready';
  }

  return 'blocked';
}

export function deriveApprovalOwnership(input: {
  agreementState: AgreementApprovalState;
  participant: DemoParticipant;
  operatorLabel?: string;
}): ApprovalOwnership {
  const { agreementState, participant, operatorLabel = 'Project operator' } = input;
  const participantName = participant.name?.trim() || 'Participant';

  switch (agreementState) {
    case 'draft':
      return {
        actor: 'operator',
        actorLabel: operatorLabel,
        waitingOn: operatorLabel,
        nextAction: 'Generate and share participation agreement',
      };
    case 'shared':
      return {
        actor: 'participant',
        actorLabel: participantName,
        waitingOn: participantName,
        nextAction: 'Approve participation agreement',
      };
    case 'participant_approved':
      return {
        actor: 'operator',
        actorLabel: operatorLabel,
        waitingOn: operatorLabel,
        nextAction: 'Complete supplier onboarding',
      };
    case 'operator_confirmed':
      return {
        actor: 'participant',
        actorLabel: participantName,
        waitingOn: participantName,
        nextAction: 'Approve participation agreement',
      };
    case 'fully_approved':
      return {
        actor: 'system',
        actorLabel: 'System',
        waitingOn: 'None',
        nextAction: 'Ready for payout release when obligations are funded',
      };
    default:
      return {
        actor: 'operator',
        actorLabel: operatorLabel,
        waitingOn: operatorLabel,
        nextAction: 'Review participant setup',
      };
  }
}

export function deriveApprovalBlockingReason(input: {
  agreementState: AgreementApprovalState;
  participant: DemoParticipant;
}): string | null {
  const { agreementState, participant } = input;
  const ownership = deriveApprovalOwnership({ agreementState, participant });

  switch (agreementState) {
    case 'draft':
      return 'Participation agreement has not been shared yet';
    case 'shared':
      return `Waiting for ${ownership.actorLabel} to approve participation agreement`;
    case 'participant_approved':
      return `Waiting for ${ownership.actorLabel} to complete supplier onboarding`;
    case 'operator_confirmed':
      return `Waiting for ${ownership.actorLabel} to approve participation agreement`;
    case 'fully_approved':
      return null;
    default:
      return null;
  }
}

export function deriveApprovalNextAction(input: {
  agreementState: AgreementApprovalState;
  participant: DemoParticipant;
}): string {
  return deriveApprovalOwnership({
    agreementState: input.agreementState,
    participant: input.participant,
  }).nextAction;
}

function reviewHref(participantId: string, projectId?: string): string {
  return projectId
    ? `${projectParticipantsPath(projectId)}?participant=${encodeURIComponent(participantId)}`
    : '#';
}

function blocker(
  partial: Omit<OperationalBlockerDetail, 'id'> & { id?: string }
): OperationalBlockerDetail {
  return {
    id: partial.id ?? `blocker-${partial.participantId ?? 'unknown'}-${partial.requiredAction}`,
    ...partial,
  };
}

/** Canonical operational blocker with actor ownership. */
export function deriveOperationalBlocker(
  participant: DemoParticipant,
  projectId?: string
): OperationalBlockerDetail[] {
  const p = normalizeParticipantEntity(participant);
  if (isParticipantPayoutReady(p)) return [];

  const blockers: OperationalBlockerDetail[] = [];
  const href = reviewHref(p.id, projectId);
  const agreementState = deriveAgreementApprovalState(p);
  const ownership = deriveApprovalOwnership({ agreementState, participant: p });

  const comp = deriveCompensationReadiness(p);
  if (comp.missingRequirements.length > 0) {
    blockers.push(
      blocker({
        severity: 'blocking',
        owner: 'operator',
        ownerLabel: 'Project operator',
        requiredAction: 'Configure participant earnings',
        resolutionRoute: href,
        unlocks: 'Payout readiness can be assessed once earnings are saved.',
        explanation: 'Earnings structure must be saved before payout readiness can be assessed.',
        participantId: p.id,
        participantName: p.name,
        ctaLabel: 'Configure earnings',
      })
    );
  }

  if (
    (agreementState === 'draft' || agreementState === 'shared' || agreementState === 'operator_confirmed') &&
    !p.compensationProfile?.exemptFromPayout
  ) {
    blockers.push(
      blocker({
        severity: 'blocking',
        owner: ownership.actor,
        ownerLabel: ownership.actorLabel,
        requiredAction: ownership.nextAction,
        resolutionRoute: href,
        unlocks:
          'Participant becomes payout-ready and obligations become releasable after agreement approval.',
        explanation: deriveApprovalBlockingReason({ agreementState, participant: p }) ?? ownership.nextAction,
        participantId: p.id,
        participantName: p.name,
        ctaLabel:
          agreementState === 'shared' || agreementState === 'operator_confirmed'
            ? 'Review agreement'
            : 'Share agreement',
      })
    );
  }

  if (
    agreementState === 'participant_approved' &&
    !p.compensationProfile?.exemptFromPayout &&
    p.payoutVerificationConfirmed !== true
  ) {
    blockers.push(
      blocker({
        severity: 'blocking',
        owner: 'operator',
        ownerLabel: 'Project operator',
        requiredAction: 'Complete supplier onboarding',
        resolutionRoute: href,
        unlocks: 'Settlement can proceed once supplier onboarding is complete and approved.',
        explanation: `Supplier onboarding required for ${p.name}. The agreement is approved — payment details, ABN, and GST must be collected before settlement.`,
        participantId: p.id,
        participantName: p.name,
        ctaLabel: 'Complete supplier setup',
      })
    );
  }

  if (p.payoutBlocked) {
    blockers.push(
      blocker({
        severity: 'blocking',
        owner: 'operator',
        ownerLabel: 'Project operator',
        requiredAction: 'Remove payout release block',
        resolutionRoute: href,
        unlocks: 'Payout release becomes available once the block is cleared.',
        explanation: `${p.name} is flagged as blocked from payout release by the operator.`,
        participantId: p.id,
        participantName: p.name,
        ctaLabel: 'Review participant',
      })
    );
  }

  return blockers;
}

export function obligationApprovalLabel(state: ObligationApprovalState, participant?: DemoParticipant): string {
  switch (state) {
    case 'pending_participant':
      return participant?.name
        ? `Waiting for ${participant.name} to approve participation agreement`
        : 'Waiting for participant agreement approval';
    case 'pending_operator':
      return 'Supplier onboarding required';
    case 'ready':
      return 'Ready for release';
    case 'blocked':
      return 'Blocked';
    default:
      return 'Review required';
  }
}

export function obligationApprovalSeverity(state: ObligationApprovalState): OperationalBlockerSeverity {
  if (state === 'ready') return 'info';
  if (state === 'pending_participant' || state === 'pending_operator') return 'warning';
  return 'blocking';
}

export function agreementApprovalLabel(state: AgreementApprovalState, participant?: DemoParticipant): string {
  switch (state) {
    case 'draft':
      return 'Agreement not shared';
    case 'shared':
      return participant?.name
        ? `Waiting for ${participant.name} to approve participation agreement`
        : 'Waiting for participant agreement approval';
    case 'participant_approved':
      return 'Participant agreement approved';
    case 'operator_confirmed':
      return 'Supplier onboarding complete';
    case 'fully_approved':
      return 'Fully approved — payout ready';
    default:
      return 'Agreement in progress';
  }
}

export function participantLifecycleApprovalLabel(
  participant: DemoParticipant
): string {
  return agreementApprovalLabel(deriveAgreementApprovalState(participant), participant);
}
