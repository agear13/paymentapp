import type { OperationalCapabilities } from '@/lib/operations/capabilities/derive-operational-capabilities';
import { assertReleaseInteractionInvariants } from '@/lib/operations/dev/operational-invariants';

export type ReleaseInteractionDisabledCategory =
  | 'activation_loading'
  | 'settlement_initializing'
  | 'graph_converging'
  | 'beta_locked'
  | 'capability_disabled'
  | null;

export type ReleaseInteractionState = {
  /** Canonical gate — release mutations and release-scoped queries may run only when true. */
  releaseInteractionEnabled: boolean;
  canQueryReleaseHistory: boolean;
  canPreviewReleaseEligibility: boolean;
  canCreateReleaseBatch: boolean;
  canSubmitRelease: boolean;
  /** Beta-gated referral commission ledger (distinct from pilot obligation reads). */
  canQueryReferralCommissionLedger: boolean;
  disabledReason: string | null;
  disabledCategory: ReleaseInteractionDisabledCategory;
  interactionGuidance: string | null;
};

export const CONSERVATIVE_RELEASE_CAPABILITIES: OperationalCapabilities = {
  canCreateReleaseBatch: false,
  canSubmitRelease: false,
  canUseBetaSettlementFeatures: false,
  disabledReason: 'Release capabilities are still loading.',
};

export type ReleaseInteractionInput = {
  operationalCapabilities: OperationalCapabilities;
  graphReady?: boolean;
  graphSnapshotConverged?: boolean;
  activationLoading?: boolean;
};

function disabledReleaseInteractionState(
  category: Exclude<ReleaseInteractionDisabledCategory, null>,
  guidance: string,
  operationalCapabilities: OperationalCapabilities
): ReleaseInteractionState {
  return {
    releaseInteractionEnabled: false,
    canQueryReleaseHistory: false,
    canPreviewReleaseEligibility: false,
    canCreateReleaseBatch: false,
    canSubmitRelease: false,
    canQueryReferralCommissionLedger: false,
    disabledReason: guidance,
    disabledCategory: category,
    interactionGuidance: guidance,
  };
}

/**
 * Canonical release interaction gate — all payout release surfaces must derive from this selector.
 */
export function deriveReleaseInteractionState(
  input: ReleaseInteractionInput
): ReleaseInteractionState {
  const { operationalCapabilities, activationLoading = false } = input;
  const graphReady = input.graphReady === true;
  const graphSnapshotConverged = input.graphSnapshotConverged === true;

  let state: ReleaseInteractionState;

  if (activationLoading) {
    state = disabledReleaseInteractionState(
      'activation_loading',
      'Loading settlement capabilities…',
      operationalCapabilities
    );
  } else if (!graphReady) {
    state = disabledReleaseInteractionState(
      'settlement_initializing',
      'Settlement coordination is still converging. Release actions unlock after payout graph synchronization.',
      operationalCapabilities
    );
  } else if (!graphSnapshotConverged) {
    state = disabledReleaseInteractionState(
      'graph_converging',
      'Operational graph still initializing. Release actions unlock once coordination snapshot synchronizes.',
      operationalCapabilities
    );
  } else if (!operationalCapabilities.canUseBetaSettlementFeatures) {
    state = disabledReleaseInteractionState(
      'beta_locked',
      operationalCapabilities.disabledReason ??
        'Release infrastructure unavailable during beta rollout.',
      operationalCapabilities
    );
  } else if (
    !operationalCapabilities.canCreateReleaseBatch &&
    !operationalCapabilities.canSubmitRelease
  ) {
    state = disabledReleaseInteractionState(
      'capability_disabled',
      operationalCapabilities.disabledReason ?? 'Release actions are not available for this workspace.',
      operationalCapabilities
    );
  } else {
    state = {
      releaseInteractionEnabled: true,
      canQueryReleaseHistory: true,
      canPreviewReleaseEligibility: true,
      canCreateReleaseBatch: operationalCapabilities.canCreateReleaseBatch,
      canSubmitRelease: operationalCapabilities.canSubmitRelease,
      canQueryReferralCommissionLedger: operationalCapabilities.canUseBetaSettlementFeatures,
      disabledReason: null,
      disabledCategory: null,
      interactionGuidance: null,
    };
  }

  assertReleaseInteractionInvariants({
    releaseInteractionEnabled: state.releaseInteractionEnabled,
    graphReady,
    graphSnapshotConverged,
    canCreateReleaseBatch: state.canCreateReleaseBatch,
    betaSettlementAllowed: operationalCapabilities.canUseBetaSettlementFeatures,
  });

  return state;
}
