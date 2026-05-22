import type { ProjectFundingSourceDto } from '@/lib/projects/funding-sources/types';
import {
  buildProjectTreasurySummary,
  type TreasuryInputs,
} from '@/lib/projects/funding-sources/treasury-summary';

export const FUNDING_LIFECYCLE_STATES = [
  'NONE',
  'FORECAST',
  'PENDING',
  'PARTIAL',
  'CONFIRMED',
  'ALLOCATED',
] as const;

export type FundingLifecycleState = (typeof FUNDING_LIFECYCLE_STATES)[number];

export const FUNDING_LIFECYCLE_LABELS: Record<FundingLifecycleState, string> = {
  NONE: 'No funding recorded',
  FORECAST: 'Forecast only',
  PENDING: 'Pending settlement',
  PARTIAL: 'Partially funded',
  CONFIRMED: 'Funding confirmed',
  ALLOCATED: 'Fully allocated to obligations',
};

export function deriveFundingLifecycleState(
  confirmedFunding: number,
  obligationsTotal: number,
  pendingFunding: number
): FundingLifecycleState {
  if (obligationsTotal <= 0 && confirmedFunding <= 0 && pendingFunding <= 0) return 'NONE';
  if (confirmedFunding + 0.005 >= obligationsTotal && obligationsTotal > 0) return 'ALLOCATED';
  if (confirmedFunding > 0) return confirmedFunding < obligationsTotal ? 'PARTIAL' : 'CONFIRMED';
  if (pendingFunding > 0) return 'PENDING';
  return 'FORECAST';
}

export type OperationalFundingState = ReturnType<typeof recalculateOperationalFundingState>;

/**
 * Canonical funding → obligation sync. Obligations derive from treasury rollup, not stale UI snapshots.
 */
export function recalculateOperationalFundingState(input: TreasuryInputs) {
  const treasury = buildProjectTreasurySummary(input);
  const fundingState = deriveFundingLifecycleState(
    treasury.confirmedFunding,
    treasury.obligationsTotal,
    treasury.pendingFunding
  );

  return {
    treasury,
    fundingState,
    obligationsTotal: treasury.obligationsTotal,
    obligationsFunded: treasury.obligationsReady,
    obligationsUnfunded: treasury.obligationsAwaitingFunding,
    payoutReadiness: treasury.operationalReadiness,
    releaseConfidenceInputs: {
      confirmedFunding: treasury.confirmedFunding,
      obligationsAwaitingFunding: treasury.obligationsAwaitingFunding,
      operationalReadiness: treasury.operationalReadiness,
    },
  };
}

export function fundingLifecyclePrerequisites(state: FundingLifecycleState): string[] {
  switch (state) {
    case 'CONFIRMED':
      return ['At least one confirmed funding source'];
    case 'ALLOCATED':
      return ['Confirmed funding covers obligations'];
    default:
      return [];
  }
}

export type { ProjectFundingSourceDto };
