/**
 * Granular funding coordination semantics — do not collapse into generic "Needs funding".
 */

export type FundingCoordinationStage = {
  /** Treasury/payment rail exists */
  fundingSourceConnected: boolean;
  /** Money allocated/reserved against obligations internally */
  fundingReserved: boolean;
  /** Funds confirmed available for obligation coverage */
  fundingSettled: boolean;
  /** Participant payout obligations fully covered */
  releaseFunded: boolean;
  /** Human-readable primary stage label */
  primaryLabel: string;
  /** Precise blocker when not release-ready */
  blockerLabel: string | null;
};

export type FundingCoordinationInput = {
  /** At least one project funding source row exists (any status). */
  hasFundingSourceRows?: boolean;
  fundingSourceConnected: boolean;
  confirmedFunding: number;
  obligationsTotal: number;
  obligationsFunded: number;
  pendingFunding?: number;
  forecastFunding?: number;
};

export function deriveFundingCoordinationStage(
  input: FundingCoordinationInput
): FundingCoordinationStage {
  const {
    hasFundingSourceRows = false,
    fundingSourceConnected,
    confirmedFunding,
    obligationsTotal,
    obligationsFunded,
    pendingFunding = 0,
    forecastFunding = 0,
  } = input;

  const sourceRowsPresent = hasFundingSourceRows || fundingSourceConnected;
  const fundingReserved = confirmedFunding > 0;
  const fundingSettled =
    obligationsTotal > 0 && confirmedFunding + 0.005 >= obligationsTotal;
  const releaseFunded =
    obligationsTotal > 0 && obligationsFunded + 0.005 >= obligationsTotal;

  let primaryLabel = 'No funding source added';
  let blockerLabel: string | null = 'Add a funding source to coordinate obligations';

  if (sourceRowsPresent && !fundingReserved && !fundingSettled) {
    primaryLabel =
      pendingFunding > 0 || forecastFunding > 0
        ? 'Funding source added — pending confirmation'
        : 'Funding source added';
    blockerLabel = 'Confirm or clear funding before payout release';
  } else if (fundingSourceConnected && !fundingReserved) {
    primaryLabel = 'Funding source connected — awaiting reservation';
    blockerLabel = 'Funding not yet reserved against obligations';
  } else if (fundingReserved && !fundingSettled) {
    primaryLabel = 'Funding reserved — awaiting settlement confirmation';
    blockerLabel = 'Funding reserved but not yet settled for obligations';
  } else if (fundingSettled && !releaseFunded) {
    primaryLabel = 'Funding secured — allocation pending';
    blockerLabel = 'Funding secured. Allocation to payout obligations pending.';
  } else if (releaseFunded) {
    primaryLabel = 'Release funded';
    blockerLabel = null;
  } else if (pendingFunding > 0) {
    primaryLabel = 'Funding pending settlement';
    blockerLabel = 'Waiting for funding confirmation';
  }

  return {
    fundingSourceConnected,
    fundingReserved,
    fundingSettled,
    releaseFunded,
    primaryLabel,
    blockerLabel,
  };
}

export function fundingStageBlockerMessage(stage: FundingCoordinationStage): string | null {
  return stage.blockerLabel;
}

export const FUNDING_STAGE_LABELS = {
  sourceConnected: 'Funding source connected',
  reserved: 'Funding reserved',
  settled: 'Funding settled',
  releaseFunded: 'Release funded',
} as const;
