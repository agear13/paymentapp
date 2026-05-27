'use client';

import * as React from 'react';
import type { OperationalCapabilities } from '@/lib/operations/capabilities/derive-operational-capabilities';
import { CONSERVATIVE_RELEASE_CAPABILITIES } from '@/lib/operations/capabilities/derive-release-interaction-state';
import {
  deriveOperationalReadinessState,
  deriveSettlementInitializationState,
  deriveOperationalOnboardingProgress,
} from '@/lib/operations/coordination';
import { useOperationalGuidance, type OperationalGuidanceOptions } from '@/hooks/use-operational-guidance';

export type OperationalCoordinationStateOptions = OperationalGuidanceOptions & {
  releaseCapabilities?: OperationalCapabilities;
};

/**
 * Unified operational coordination hook — canonical readiness, settlement init, and onboarding progress.
 */
export function useOperationalCoordinationState(options?: OperationalCoordinationStateOptions) {
  const guidanceState = useOperationalGuidance(options);
  const operationalCapabilities =
    options?.releaseCapabilities ?? CONSERVATIVE_RELEASE_CAPABILITIES;

  const readiness = React.useMemo(
    () =>
      deriveOperationalReadinessState({
        operationalOnboarding: guidanceState.operationalOnboarding,
        operationalInitialization: guidanceState.operationalInitialization,
        graphSnapshotConverged: guidanceState.graphSnapshotConverged,
        activationLoading: guidanceState.loading,
        operationalCapabilities,
        workspace: guidanceState.workspaceContext,
      }),
    [
      guidanceState.operationalOnboarding,
      guidanceState.operationalInitialization,
      guidanceState.graphSnapshotConverged,
      guidanceState.loading,
      guidanceState.workspaceContext,
      operationalCapabilities,
    ]
  );

  const settlementInitialization = React.useMemo(
    () =>
      deriveSettlementInitializationState({
        activationLoading: guidanceState.loading,
        operationalOnboarding: guidanceState.operationalOnboarding,
        operationalInitialization: guidanceState.operationalInitialization,
        graphSnapshotConverged: guidanceState.graphSnapshotConverged,
        nextActions: guidanceState.guidance.actions,
      }),
    [
      guidanceState.loading,
      guidanceState.operationalOnboarding,
      guidanceState.operationalInitialization,
      guidanceState.graphSnapshotConverged,
      guidanceState.guidance.actions,
    ]
  );

  const onboardingProgress = React.useMemo(
    () =>
      deriveOperationalOnboardingProgress({
        operationalOnboarding: guidanceState.operationalOnboarding,
        workspace: guidanceState.workspaceContext,
        graphSnapshotConverged: guidanceState.graphSnapshotConverged,
        releaseBlockers: guidanceState.guidance.releaseBlockers,
        explanation: guidanceState.guidance.explanation,
      }),
    [
      guidanceState.operationalOnboarding,
      guidanceState.workspaceContext,
      guidanceState.graphSnapshotConverged,
      guidanceState.guidance.releaseBlockers,
      guidanceState.guidance.explanation,
    ]
  );

  return {
    ...guidanceState,
    readiness,
    settlementInitialization,
    onboardingProgress,
    releaseInteraction: readiness.releaseInteraction,
  };
}
