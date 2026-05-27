import { DealNetworkPilotObligationStatus } from '@prisma/client';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  deriveAgreementApprovalState,
  deriveObligationApprovalState,
  obligationApprovalLabel,
} from '@/lib/operations/derivations/derive-approval-state';
import { isParticipantPayoutReady } from '@/lib/operations/truth/payout-truth';
import type { ObligationOperationalReadiness } from '@/lib/projects/funding-sources/types';
import { operatorStatusLabel } from '@/lib/payouts/obligation-status-labels';
import type { FundingCoordinationStage } from '@/lib/operations/truth/funding-coordination-semantics';

/** Canonical persisted obligation status from participant agreement + funding convergence. */
export function resolvePersistedObligationStatus(input: {
  participant: DemoParticipant;
  deal: RecentDeal;
  moneyConfirmed: boolean;
  fullyFunded: boolean;
}): DealNetworkPilotObligationStatus {
  const payoutSettlement = input.participant.payoutSettlementStatus;
  if (payoutSettlement === 'Paid') {
    return DealNetworkPilotObligationStatus.PAID;
  }

  const agreement = deriveAgreementApprovalState(input.participant);
  const payoutReady = isParticipantPayoutReady(input.participant);

  if (payoutReady && agreement === 'fully_approved') {
    if (!input.moneyConfirmed) {
      return DealNetworkPilotObligationStatus.UNFUNDED;
    }
    return input.fullyFunded
      ? DealNetworkPilotObligationStatus.AVAILABLE_FOR_PAYOUT
      : DealNetworkPilotObligationStatus.APPROVED;
  }

  if (payoutSettlement === 'Approved' || payoutSettlement === 'Eligible') {
    if (!input.moneyConfirmed) {
      return DealNetworkPilotObligationStatus.UNFUNDED;
    }
    return input.fullyFunded
      ? DealNetworkPilotObligationStatus.AVAILABLE_FOR_PAYOUT
      : DealNetworkPilotObligationStatus.APPROVED;
  }

  if (agreement === 'participant_approved' || agreement === 'operator_confirmed') {
    return DealNetworkPilotObligationStatus.PENDING_APPROVAL;
  }

  if (agreement === 'fully_approved') {
    return input.moneyConfirmed
      ? DealNetworkPilotObligationStatus.APPROVED
      : DealNetworkPilotObligationStatus.PENDING_APPROVAL;
  }

  return DealNetworkPilotObligationStatus.PENDING_APPROVAL;
}

export function resolveObligationOperationalReadiness(input: {
  allocationStatus: string;
  participant?: DemoParticipant | null;
  amountOwed: number;
  amountFunded: number;
}): ObligationOperationalReadiness {
  const status = input.allocationStatus.toUpperCase();
  const approval = deriveObligationApprovalState({
    obligationStatus: status,
    participant: input.participant ?? undefined,
  });

  if (status === 'PAID' || status === 'AVAILABLE_FOR_PAYOUT') return 'ready';
  if (status === 'APPROVED') {
    if (input.amountFunded + 0.005 >= input.amountOwed) return 'ready';
    if (approval === 'ready') return 'awaiting_funding';
    return 'blocked';
  }
  if (status === 'PARTIALLY_FUNDED') return 'partially_funded';
  if (status === 'UNFUNDED' || status === 'DRAFT') return 'awaiting_funding';
  if (status === 'PENDING_APPROVAL') {
    if (approval === 'ready') {
      return input.amountFunded + 0.005 >= input.amountOwed ? 'ready' : 'awaiting_funding';
    }
    return 'blocked';
  }
  if (status === 'REJECTED' || status === 'REVERSED') return 'blocked';
  return 'awaiting_funding';
}

export function resolveObligationAmountFunded(input: {
  allocationStatus: string;
  amountOwed: number;
  participant?: DemoParticipant | null;
  paymentLinked?: boolean;
}): number {
  const status = input.allocationStatus.toUpperCase();
  const owed = input.amountOwed;
  if (status === 'PAID' || status === 'AVAILABLE_FOR_PAYOUT') return owed;
  if (status === 'PARTIALLY_FUNDED') return owed;
  if (status === 'APPROVED' || status === 'PENDING_APPROVAL') {
    const approval = deriveObligationApprovalState({
      obligationStatus: status,
      participant: input.participant ?? undefined,
    });
    if (approval === 'ready' && input.paymentLinked) return owed;
    if (status === 'APPROVED' && input.paymentLinked) return owed;
  }
  return 0;
}

/** Operator-facing allocation label — derives from agreement state, not raw enum text. */
export function resolveObligationAllocationLabel(input: {
  allocationStatus: string;
  participant?: DemoParticipant | null;
  fundingStage?: FundingCoordinationStage | null;
}): string {
  const participant = input.participant ?? undefined;
  const status = input.allocationStatus as DealNetworkPilotObligationStatus;
  return operatorStatusLabel(status, participant ?? null, input.fundingStage ?? null);
}

export function obligationAllocationApprovalLabel(input: {
  allocationStatus: string;
  participant?: DemoParticipant | null;
}): string {
  return obligationApprovalLabel(
    deriveObligationApprovalState({
      obligationStatus: input.allocationStatus,
      participant: input.participant ?? undefined,
    }),
    input.participant ?? undefined
  );
}
