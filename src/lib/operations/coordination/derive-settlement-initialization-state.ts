import { onboardingInitializationProgress } from '@/lib/operations/onboarding/operational-onboarding-phases';
import type { OperationalOnboardingState } from '@/lib/operations/onboarding/operational-onboarding-phases';
import type { OperationalInitializationSnapshot } from '@/lib/operations/onboarding/operational-transition-types';
import type { OperationalAction } from '@/lib/operations/explainability/types';
import type { SettlementInitializationState } from '@/lib/operations/coordination/types';
import { isGraphReadyForProjection } from '@/lib/operations/coordination/derive-operational-readiness-state';

export type SettlementInitializationInput = {
  activationLoading?: boolean;
  operationalOnboarding?: OperationalOnboardingState | null;
  operationalInitialization?: OperationalInitializationSnapshot | null;
  graphSnapshotConverged?: boolean;
  nextActions?: OperationalAction[];
  /** When persisted operational data exists, do not replace pages with init shell. */
  participantCount?: number;
  earningsConfiguredCount?: number;
  obligationCount?: number;
  obligationsLoadedCount?: number;
};

/**
 * Canonical settlement initialization presentation — replaces direct graphReady UI checks.
 */
export function deriveSettlementInitializationState(
  input: SettlementInitializationInput
): SettlementInitializationState {
  const activationLoading = input.activationLoading === true;
  const effectiveOnboarding =
    input.operationalInitialization?.onboarding ?? input.operationalOnboarding ?? null;
  const graphReady = isGraphReadyForProjection(
    effectiveOnboarding,
    input.operationalInitialization
  );
  const graphConverged = input.graphSnapshotConverged === true;

  const hasOperationalEvidence =
    (input.participantCount ?? 0) > 0 ||
    (input.earningsConfiguredCount ?? 0) > 0 ||
    (input.obligationCount ?? 0) > 0 ||
    (input.obligationsLoadedCount ?? 0) > 0;

  const showInitializationShell =
    activationLoading || (!graphReady && !hasOperationalEvidence);

  const progress = effectiveOnboarding
    ? onboardingInitializationProgress(effectiveOnboarding)
    : {
        headline: 'Settlement infrastructure initializing',
        steps: [],
      };

  return {
    showInitializationShell,
    allowChildProjections: graphReady && graphConverged && !activationLoading,
    headline: progress.headline,
    recoveryMessage: effectiveOnboarding?.recoveryMessage ?? null,
    progressSteps: progress.steps,
    blockers: effectiveOnboarding?.blockers ?? [],
    nextActions: input.nextActions ?? [],
  };
}
