import type { OperationalCapabilities } from '@/lib/operations/capabilities/derive-operational-capabilities';
import {
  deriveReleaseInteractionState,
  type ReleaseInteractionState,
} from '@/lib/operations/capabilities/derive-release-interaction-state';
import type { OperationalOnboardingState } from '@/lib/operations/onboarding/operational-onboarding-phases';
import type { OperationalInitializationSnapshot } from '@/lib/operations/onboarding/operational-transition-types';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import { assertOperationalReadinessInvariants } from '@/lib/operations/dev/operational-invariants';
import type { OperationalReadinessPhase, OperationalReadinessState } from '@/lib/operations/coordination/types';

export type OperationalReadinessInput = {
  operationalOnboarding?: OperationalOnboardingState | null;
  operationalInitialization?: OperationalInitializationSnapshot | null;
  graphSnapshotConverged?: boolean;
  activationLoading?: boolean;
  operationalCapabilities: OperationalCapabilities;
  workspace?: WorkspaceOperationalContext;
};

/** Canonical graph-ready gate — replaces ad-hoc graphReady checks in UI. */
export function isGraphReadyForProjection(
  onboarding: OperationalOnboardingState | null | undefined,
  initialization?: OperationalInitializationSnapshot | null
): boolean {
  if (initialization?.graphReady === true) return true;
  if (!onboarding) return false;
  return onboarding.graphReady === true || onboarding.phase === 'OPERATIONAL_GRAPH_READY';
}

function resolvePhase(input: {
  activationLoading: boolean;
  graphReadyForProjection: boolean;
  graphSnapshotConverged: boolean;
  releaseInteraction: ReleaseInteractionState;
  releaseEligibleCount: number;
}): OperationalReadinessPhase {
  if (input.activationLoading) return 'activation_loading';
  if (!input.graphReadyForProjection) return 'settlement_initializing';
  if (!input.graphSnapshotConverged) return 'graph_converging';
  if (
    input.releaseInteraction.releaseInteractionEnabled &&
    input.releaseEligibleCount > 0
  ) {
    return 'release_ready';
  }
  return 'coordination_active';
}

function phaseGuidance(phase: OperationalReadinessPhase, releaseInteraction: ReleaseInteractionState): {
  headline: string;
  guidance: string;
} {
  switch (phase) {
    case 'activation_loading':
      return {
        headline: 'Loading operational coordination',
        guidance: 'Settlement capabilities are loading.',
      };
    case 'settlement_initializing':
      return {
        headline: 'Settlement infrastructure initializing',
        guidance:
          releaseInteraction.interactionGuidance ??
          'Payment rails are connected. Operational coordination is preparing payout graph projections.',
      };
    case 'graph_converging':
      return {
        headline: 'Operational graph synchronizing',
        guidance:
          releaseInteraction.interactionGuidance ??
          'Coordination snapshot is converging. Release actions unlock once projections synchronize.',
      };
    case 'release_ready':
      return {
        headline: 'Ready for payout release review',
        guidance: 'Participants and funding have converged in the operational graph.',
      };
    case 'coordination_active':
    default:
      return {
        headline: 'Operational coordination active',
        guidance: releaseInteraction.interactionGuidance ?? 'Continue operational setup tasks below.',
      };
  }
}

/**
 * Canonical operational readiness — single source for projection, release, and initialization gates.
 */
export function deriveOperationalReadinessState(
  input: OperationalReadinessInput
): OperationalReadinessState {
  const activationLoading = input.activationLoading === true;
  const graphReadyForProjection = isGraphReadyForProjection(
    input.operationalOnboarding,
    input.operationalInitialization
  );
  const graphSnapshotConverged = input.graphSnapshotConverged === true;
  const releaseInteraction = deriveReleaseInteractionState({
    operationalCapabilities: input.operationalCapabilities,
    graphReady: graphReadyForProjection,
    graphSnapshotConverged,
    activationLoading,
  });

  const releaseEligibleCount = input.workspace?.releaseEligibleCount ?? 0;
  const phase = resolvePhase({
    activationLoading,
    graphReadyForProjection,
    graphSnapshotConverged,
    releaseInteraction,
    releaseEligibleCount,
  });
  const { headline, guidance } = phaseGuidance(phase, releaseInteraction);

  const state: OperationalReadinessState = {
    phase,
    graphReadyForProjection,
    graphSnapshotConverged,
    canProjectGuidance: graphReadyForProjection && graphSnapshotConverged,
    settlementInfrastructureReady: graphReadyForProjection,
    releaseInteraction,
    headline,
    guidance,
  };

  assertOperationalReadinessInvariants({
    phase,
    graphReadyForProjection,
    graphSnapshotConverged,
    releaseInteractionEnabled: releaseInteraction.releaseInteractionEnabled,
  });

  return state;
}
