import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { deriveObligationApprovalState } from '@/lib/operations/derivations/derive-approval-state';
import { resolveObligationOperationalReadiness } from '@/lib/operations/derivations/derive-obligation-allocation-status';
import { isParticipantPayoutReady } from '@/lib/operations/truth/payout-truth';
import {
  assertPayoutExplainabilityInvariants,
  type PayoutExplainabilityInvariantInput,
} from '@/lib/operations/dev/operational-invariants';
import {
  isApprovedButNotOnboarded,
  isOnboardingComplete,
  type PilotParticipantOnboardingStatus,
} from '@/lib/deal-network-demo/participant-onboarding';

export const PARTICIPANT_EARNINGS_BUCKETS = [
  'ready_for_release',
  'needs_funding',
  'awaiting_participant_approval',
  'awaiting_payout_details',
  'awaiting_orchestration_refresh',
  'awaiting_participant_setup',
  'recently_released',
] as const;

export type ParticipantEarningsBucket = (typeof PARTICIPANT_EARNINGS_BUCKETS)[number];

export type ParticipantEarningsRowInput = {
  id: string;
  status: string;
  amountOwed?: number;
  amountFunded?: number;
  participant?: DemoParticipant | null;
};

export type ParticipantEarningsBucketMeta = {
  id: ParticipantEarningsBucket;
  title: string;
  description: string;
};

export const PARTICIPANT_EARNINGS_BUCKET_META: Record<
  ParticipantEarningsBucket,
  ParticipantEarningsBucketMeta
> = {
  ready_for_release: {
    id: 'ready_for_release',
    title: 'Ready for release',
    description: 'Eligible to include in the next release batch.',
  },
  needs_funding: {
    id: 'needs_funding',
    title: 'Needs funding',
    description: 'Earnings waiting on confirmed project funding before payout release.',
  },
  awaiting_participant_approval: {
    id: 'awaiting_participant_approval',
    title: 'Awaiting participant agreement',
    description: 'Participant must approve the participation agreement.',
  },
  awaiting_payout_details: {
    id: 'awaiting_payout_details',
    title: 'Awaiting payout confirmation',
    description: 'Operator must verify external payout details for this participant.',
  },
  awaiting_orchestration_refresh: {
    id: 'awaiting_orchestration_refresh',
    title: 'Awaiting coordination refresh',
    description:
      'Approvals and funding are satisfied — refresh obligations to update allocation status.',
  },
  awaiting_participant_setup: {
    id: 'awaiting_participant_setup',
    title: 'Awaiting participant setup',
    description: 'Approved participants completing payout onboarding.',
  },
  recently_released: {
    id: 'recently_released',
    title: 'Recently released',
    description: 'Participant payouts from completed release batches.',
  },
};

function asOnboardingStatus(value?: string): PilotParticipantOnboardingStatus | undefined {
  if (value === 'NOT_STARTED' || value === 'INCOMPLETE' || value === 'COMPLETE') {
    return value;
  }
  if (value === 'Complete') return 'COMPLETE';
  return undefined;
}

/** Canonical earnings queue bucket — do not infer from raw obligation enum alone. */
export function deriveParticipantEarningsBucket(
  row: ParticipantEarningsRowInput
): ParticipantEarningsBucket {
  const status = row.status.toUpperCase();
  const participant = row.participant ?? undefined;
  const amountOwed = row.amountOwed ?? 0;
  const amountFunded = row.amountFunded ?? 0;

  if (status === 'PAID') return 'recently_released';
  if (status === 'AVAILABLE_FOR_PAYOUT') return 'ready_for_release';

  const approval = deriveObligationApprovalState({
    obligationStatus: status,
    participant,
  });
  const readiness = resolveObligationOperationalReadiness({
    allocationStatus: status,
    participant,
    amountOwed,
    amountFunded,
  });

  if (
    status === 'APPROVED' &&
    participant &&
    isApprovedButNotOnboarded({
      id: participant.id,
      approvalStatus: participant.approvalStatus === 'Approved' ? 'Approved' : 'Pending approval',
      onboardingStatus: asOnboardingStatus(participant.onboardingStatus),
    })
  ) {
    return 'awaiting_participant_setup';
  }

  if (
    status === 'APPROVED' &&
    participant?.onboardingStatus &&
    !isOnboardingComplete(asOnboardingStatus(participant.onboardingStatus) ?? 'INCOMPLETE')
  ) {
    return 'awaiting_participant_setup';
  }

  if (approval === 'pending_participant') {
    return 'awaiting_participant_approval';
  }

  if (approval === 'pending_operator') {
    return 'awaiting_payout_details';
  }

  if (status === 'PENDING_APPROVAL' && approval === 'ready') {
    return 'awaiting_orchestration_refresh';
  }

  if (approval === 'ready' && readiness === 'ready') {
    return 'ready_for_release';
  }

  if (approval === 'ready' && (status === 'PENDING_APPROVAL' || status === 'UNFUNDED')) {
    return 'awaiting_orchestration_refresh';
  }

  if (status === 'APPROVED' && participant && isParticipantPayoutReady(participant)) {
    return readiness === 'ready' ? 'ready_for_release' : 'awaiting_orchestration_refresh';
  }

  if (['UNFUNDED', 'PARTIALLY_FUNDED', 'DRAFT'].includes(status)) {
    if (participant && isParticipantPayoutReady(participant)) {
      return 'awaiting_orchestration_refresh';
    }
    return 'needs_funding';
  }

  if (status === 'PENDING_APPROVAL') {
    return 'awaiting_participant_approval';
  }

  return 'needs_funding';
}

export function groupParticipantEarningsByBucket<T extends ParticipantEarningsRowInput>(
  rows: T[]
): Record<ParticipantEarningsBucket, T[]> {
  const grouped = Object.fromEntries(
    PARTICIPANT_EARNINGS_BUCKETS.map((b) => [b, [] as T[]])
  ) as Record<ParticipantEarningsBucket, T[]>;

  for (const row of rows) {
    const bucket = deriveParticipantEarningsBucket(row);
    grouped[bucket].push(row);
  }

  if (typeof window === 'undefined') {
    const mislabeledFunding = rows.filter((row) => {
      const bucket = deriveParticipantEarningsBucket(row);
      return (
        bucket === 'needs_funding' &&
        row.participant &&
        isParticipantPayoutReady(row.participant) &&
        deriveObligationApprovalState({
          obligationStatus: row.status,
          participant: row.participant,
        }) === 'ready'
      );
    });
    assertPayoutExplainabilityInvariants({
      earningsMarkedNeedsFundingWhenFunded: mislabeledFunding.length > 0,
    });
  }

  return grouped;
}
