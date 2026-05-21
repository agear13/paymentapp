import type { DealNetworkPilotObligationStatus } from '@prisma/client';
import {
  isApprovedButNotOnboarded,
  isOnboardingComplete,
} from '@/lib/deal-network-demo/participant-onboarding';

export const OPERATOR_OBLIGATION_STATUS_LABELS: Record<
  DealNetworkPilotObligationStatus,
  string
> = {
  UNFUNDED: 'Needs funding',
  PARTIALLY_FUNDED: 'Partially funded',
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Awaiting approval',
  APPROVED: 'Approved',
  AVAILABLE_FOR_PAYOUT: 'Ready for payout',
  PAID: 'Paid',
  REVERSED: 'Reversed payment',
  REJECTED: 'Approval rejected',
};

export function operatorStatusLabel(
  status: DealNetworkPilotObligationStatus | string
): string {
  const key = status as DealNetworkPilotObligationStatus;
  return OPERATOR_OBLIGATION_STATUS_LABELS[key] ?? String(status).replace(/_/g, ' ');
}

type NextActionInput = {
  status: DealNetworkPilotObligationStatus;
  obligation_type: string;
  participant?: {
    id: string;
    approvalStatus?: string;
    onboardingStatus?: string;
  } | null;
};

export function getObligationNextAction(row: NextActionInput): string {
  if (row.status === 'UNFUNDED' || row.status === 'PARTIALLY_FUNDED') {
    return 'Add funding';
  }
  if (row.status === 'PENDING_APPROVAL') {
    return 'Approve payout';
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
        onboardingStatus: row.participant.onboardingStatus,
      })
    ) {
      return 'Complete onboarding';
    }
    if (
      row.participant.onboardingStatus != null &&
      !isOnboardingComplete(row.participant.onboardingStatus)
    ) {
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
    return 'Funding required';
  }
  if (row.status === 'PENDING_APPROVAL') {
    return 'Awaiting approval';
  }
  if (row.status === 'APPROVED' && row.participant && row.obligation_type !== 'PLATFORM_FEE') {
    if (
      isApprovedButNotOnboarded({
        id: row.participant.id,
        approvalStatus:
          row.participant.approvalStatus === 'Approved' ? 'Approved' : 'Pending approval',
        onboardingStatus: row.participant.onboardingStatus,
      })
    ) {
      return 'Participant setup incomplete';
    }
    if (
      row.participant.onboardingStatus != null &&
      !isOnboardingComplete(row.participant.onboardingStatus)
    ) {
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
