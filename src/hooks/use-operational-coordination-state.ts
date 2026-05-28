'use client';

import * as React from 'react';
import type { OperationalCapabilities } from '@/lib/operations/capabilities/derive-operational-capabilities';
import { CONSERVATIVE_RELEASE_CAPABILITIES } from '@/lib/operations/capabilities/derive-release-interaction-state';
import {
  deriveOperationalReadinessState,
  deriveSettlementInitializationState,
  deriveOperationalOnboardingProgress,
} from '@/lib/operations/coordination';
import {
  useCanonicalOperationalState,
  type CanonicalOperationalStateOptions,
} from '@/hooks/use-canonical-operational-state';

export type OperationalCoordinationStateOptions = CanonicalOperationalStateOptions & {
  releaseCapabilities?: OperationalCapabilities;
};

/**
 * Unified operational coordination hook — delegates to canonical reducer state.
 */
export function useOperationalCoordinationState(options?: OperationalCoordinationStateOptions) {
  const canonical = useCanonicalOperationalState(options);
  const operationalCapabilities =
    options?.releaseCapabilities ?? CONSERVATIVE_RELEASE_CAPABILITIES;

  const readiness = React.useMemo(
    () =>
      deriveOperationalReadinessState({
        operationalOnboarding: canonical.operationalOnboarding,
        operationalInitialization: canonical.operationalInitialization,
        graphSnapshotConverged: canonical.graphSnapshotConverged,
        activationLoading: canonical.loading,
        operationalCapabilities,
        workspace: canonical.workspaceContext,
      }),
    [
      canonical.operationalOnboarding,
      canonical.operationalInitialization,
      canonical.graphSnapshotConverged,
      canonical.loading,
      canonical.workspaceContext,
      operationalCapabilities,
    ]
  );

  const settlementInitialization = React.useMemo(
    () =>
      deriveSettlementInitializationState({
        activationLoading: canonical.loading,
        operationalOnboarding: canonical.operationalOnboarding,
        operationalInitialization: canonical.operationalInitialization,
        graphSnapshotConverged: canonical.graphSnapshotConverged,
        nextActions: canonical.guidance.actions,
      }),
    [
      canonical.loading,
      canonical.operationalOnboarding,
      canonical.operationalInitialization,
      canonical.graphSnapshotConverged,
      canonical.guidance.actions,
    ]
  );

  const onboardingProgress = React.useMemo(
    () =>
      deriveOperationalOnboardingProgress({
        operationalOnboarding: canonical.operationalOnboarding,
        workspace: canonical.workspaceContext,
        graphSnapshotConverged: canonical.graphSnapshotConverged,
        releaseBlockers: canonical.releaseBlockers,
        explanation: canonical.guidance.explanation,
      }),
    [
      canonical.operationalOnboarding,
      canonical.workspaceContext,
      canonical.graphSnapshotConverged,
      canonical.releaseBlockers,
      canonical.guidance.explanation,
    ]
  );

  return {
    ...canonical,
    readiness,
    settlementInitialization,
    onboardingProgress,
    releaseInteraction: readiness.releaseInteraction,
  };
}
