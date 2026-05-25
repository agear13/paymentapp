import type { DealNetworkPilotObligationStatus } from '@prisma/client';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  deriveObligationApprovalState,
  obligationApprovalLabel,
} from '@/lib/operations/derivations/derive-approval-state';
import type { FundingCoordinationStage } from '@/lib/operations/truth/funding-coordination-semantics';
import {
  isApprovedButNotOnboarded,
  isOnboardingComplete,
  type PilotParticipantOnboardingStatus,
} from '@/lib/deal-network-demo/participant-onboarding';

function asPilotOnboardingStatus(
  value?: string
): PilotParticipantOnboardingStatus | undefined {
  if (value === 'NOT_STARTED' || value === 'INCOMPLETE' || value === 'COMPLETE') {
    return value;
  }
  return undefined;
}

function unfundedLabel(stage?: FundingCoordinationStage | null): string {
  if (!stage) return 'Funding not reserved';
  if (!stage.fundingSourceConnected) return 'No funding source connected';
  if (!stage.fundingReserved) return 'Funding source connected — awaiting reservation';
  if (!stage.fundingSettled) return 'Funding reserved — awaiting settlement';
  return stage.blockerLabel ?? 'Obligations not yet fully funded for release';
}

function partiallyFundedLabel(stage?: FundingCoordinationStage | null): string {
  if (stage?.blockerLabel) return stage.blockerLabel;
  return 'Partially funded — allocation incomplete';
}

export const OPERATOR_OBLIGATION_STATUS_LABELS: Record<
  DealNetworkPilotObligationStatus,
  string
> = {
  UNFUNDED: 'Funding not reserved',
  PARTIALLY_FUNDED: 'Partially funded — allocation incomplete',
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Waiting for participant agreement approval',
  APPROVED: 'Approved',
  AVAILABLE_FOR_PAYOUT: 'Ready for payout',
  PAID: 'Paid',
  REVERSED: 'Reversed payment',
  REJECTED: 'Approval rejected',
};

export function operatorStatusLabel(
  status: DealNetworkPilotObligationStatus | string,
  participant?: DemoParticipant | null,
  fundingStage?: FundingCoordinationStage | null
): string {
  const key = status as DealNetworkPilotObligationStatus;
  if (key === 'UNFUNDED') {
    return unfundedLabel(fundingStage);
  }
  if (key === 'PARTIALLY_FUNDED') {
    return partiallyFundedLabel(fundingStage);
  }
  if (key === 'PENDING_APPROVAL' && participant) {
    return obligationApprovalLabel(
      deriveObligationApprovalState({ obligationStatus: key, participant }),
      participant
    );
  }
  return OPERATOR_OBLIGATION_STATUS_LABELS[key] ?? String(status).replace(/_/g, ' ');
}

type NextActionInput = {
  status: DealNetworkPilotObligationStatus;
  obligation_type: string;
  participant?: {
    id: string;
    name?: string;
    approvalStatus?: string;
    onboardingStatus?: string;
  } | null;
  fundingStage?: FundingCoordinationStage | null;
};

export function getObligationNextAction(row: NextActionInput): string {
  if (row.status === 'UNFUNDED') {
    return unfundedLabel(row.fundingStage);
  }
  if (row.status === 'PARTIALLY_FUNDED') {
    return partiallyFundedLabel(row.fundingStage);
  }
  if (row.status === 'PENDING_APPROVAL') {
    const participant = row.participant
      ? ({
          id: row.participant.id,
          name: row.participant.name ?? 'Participant',
          approvalStatus:
            row.participant.approvalStatus === 'Approved' ? 'Approved' : 'Pending approval',
        } as DemoParticipant)
      : null;
    const approval = deriveObligationApprovalState({
      obligationStatus: row.status,
      participant,
    });
    if (approval === 'pending_participant') {
      return participant?.name
        ? `Waiting for ${participant.name} to approve agreement`
        : 'Waiting for participant agreement approval';
    }
    return 'Confirm payout details';
  }
  if (row.status === 'AVAILABLE_FOR_PAYOUT') {
    return 'Ready to release';
  }
  if (row.status === 'PAID') {
    return 'Completed';
  }
  if (row.status === 'REJECTED') {
    return 'Review rejection';
  }
  if (row.status === 'REVERSED') {
    return 'Review reversal';
  }
  if (row.status === 'APPROVED' && row.participant && row.obligation_type !== 'PLATFORM_FEE') {
    if (
      isApprovedButNotOnboarded({
        id: row.participant.id,
        approvalStatus:
          row.participant.approvalStatus === 'Approved' ? 'Approved' : 'Pending approval',
        onboardingStatus: asPilotOnboardingStatus(row.participant.onboardingStatus),
      })
    ) {
      return 'Complete onboarding';
    }
    const onboardingStatus = asPilotOnboardingStatus(row.participant.onboardingStatus);
    if (onboardingStatus != null && !isOnboardingComplete(onboardingStatus)) {
      return 'Complete onboarding';
    }
  }
  if (row.status === 'DRAFT') {
    return 'Complete setup';
  }
  return 'Review';
}

/** Operator-facing blocker — empty when nothing is blocking release. */
export function getObligationBlockingIssue(row: NextActionInput): string | null {
  if (row.status === 'UNFUNDED' || row.status === 'PARTIALLY_FUNDED') {
    return unfundedLabel(row.fundingStage);
  }
  if (row.status === 'PENDING_APPROVAL') {
    const participant = row.participant
      ? ({
          id: row.participant.id,
          name: row.participant.name ?? 'Participant',
          approvalStatus:
            row.participant.approvalStatus === 'Approved' ? 'Approved' : 'Pending approval',
        } as DemoParticipant)
      : null;
    return obligationApprovalLabel(
      deriveObligationApprovalState({ obligationStatus: row.status, participant }),
      participant ?? undefined
    );
  }
  if (row.status === 'APPROVED' && row.participant && row.obligation_type !== 'PLATFORM_FEE') {
    if (
      isApprovedButNotOnboarded({
        id: row.participant.id,
        approvalStatus:
          row.participant.approvalStatus === 'Approved' ? 'Approved' : 'Pending approval',
        onboardingStatus: asPilotOnboardingStatus(row.participant.onboardingStatus),
      })
    ) {
      return 'Participant setup incomplete';
    }
    const onboardingStatus = asPilotOnboardingStatus(row.participant.onboardingStatus);
    if (onboardingStatus != null && !isOnboardingComplete(onboardingStatus)) {
      return 'Participant setup incomplete';
    }
  }
  if (row.status === 'DRAFT') {
    return 'Setup incomplete';
  }
  if (row.status === 'REJECTED') {
    return 'Approval rejected';
  }
  if (row.status === 'REVERSED') {
    return 'Payment reversed';
  }
  return null;
}
