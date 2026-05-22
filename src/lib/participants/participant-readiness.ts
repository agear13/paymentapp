import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  isOnboardingComplete,
  effectiveOnboardingStatus,
} from '@/lib/deal-network-demo/participant-onboarding';
import {
  deriveAllocationStatus,
  derivePayoutDestinationStatus,
  isCompensationConfigured,
  isCompensationExempt,
} from '@/lib/participants/participant-compensation';
import type {
  AllocationStatus,
  ParticipantPayoutDestinationStatus,
} from '@/lib/participants/participant-compensation-types';

export type ParticipantReadinessSnapshot = {
  participantId: string;
  name: string;
  allocationStatus: AllocationStatus;
  payoutDestinationStatus: ParticipantPayoutDestinationStatus;
  isPayoutReady: boolean;
  readinessReasons: string[];
  primaryIssue: string | null;
};

export type ProjectReadinessGapSummary = {
  missingCompensation: number;
  missingPayoutDestinations: number;
  missingCompliance: number;
  payoutReadyCount: number;
  total: number;
  gapLabels: string[];
};

function compensationIssueLabel(participant: DemoParticipant): string | null {
  if (isCompensationExempt(participant)) return null;
  if (isCompensationConfigured(participant)) return null;
  const type = participant.compensationProfile?.compensationType;
  if (type === 'REIMBURSEMENT') return 'Invoice reimbursement structure missing';
  if (participant.participationModel === 'revenue_share') return 'Revenue share not configured';
  return 'Compensation model missing';
}

export function deriveParticipantReadiness(
  participant: DemoParticipant
): ParticipantReadinessSnapshot {
  const reasons: string[] = [];
  const allocationStatus = deriveAllocationStatus(participant);
  const payoutDestinationStatus = derivePayoutDestinationStatus(participant);

  const compIssue = compensationIssueLabel(participant);
  if (compIssue) reasons.push(compIssue);

  if (payoutDestinationStatus === 'not_configured' && !isCompensationExempt(participant)) {
    if (!participant.email?.trim()) {
      reasons.push('Payout destination missing');
    } else if (!isOnboardingComplete(effectiveOnboardingStatus(participant))) {
      reasons.push('Payout onboarding incomplete');
    }
  }

  if (
    participant.approvalStatus !== 'Approved' &&
    !isCompensationExempt(participant)
  ) {
    reasons.push('Agreement not approved');
  }

  const isPayoutReady =
    reasons.length === 0 &&
    allocationStatus !== 'missing' &&
    payoutDestinationStatus === 'configured';

  return {
    participantId: participant.id,
    name: participant.name,
    allocationStatus,
    payoutDestinationStatus,
    isPayoutReady,
    readinessReasons: reasons,
    primaryIssue: reasons[0] ?? null,
  };
}

export function summarizeProjectReadinessGaps(
  participants: DemoParticipant[]
): ProjectReadinessGapSummary {
  const snapshots = participants.map(deriveParticipantReadiness);
  let missingCompensation = 0;
  let missingPayoutDestinations = 0;
  let missingCompliance = 0;
  let payoutReadyCount = 0;

  for (const s of snapshots) {
    if (s.isPayoutReady) payoutReadyCount += 1;
    if (s.readinessReasons.some((r) => r.includes('Compensation') || r.includes('Revenue share') || r.includes('reimbursement'))) {
      missingCompensation += 1;
    }
    if (s.readinessReasons.some((r) => r.includes('Payout destination') || r.includes('onboarding'))) {
      missingPayoutDestinations += 1;
    }
    if (s.readinessReasons.some((r) => r.includes('Agreement'))) {
      missingCompliance += 1;
    }
  }

  const gapLabels: string[] = [];
  if (missingCompensation > 0) gapLabels.push('Compensation structures');
  if (missingPayoutDestinations > 0) gapLabels.push('Payout destinations');
  if (missingCompliance > 0) gapLabels.push('Compliance details');

  return {
    missingCompensation,
    missingPayoutDestinations,
    missingCompliance,
    payoutReadyCount,
    total: participants.length,
    gapLabels,
  };
}

export function countPayoutReadyParticipants(participants: DemoParticipant[]): number {
  return participants.filter((p) => deriveParticipantReadiness(p).isPayoutReady).length;
}
