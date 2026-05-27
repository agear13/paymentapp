'use client';

import * as React from 'react';
import type { OperationalCapabilities } from '@/lib/operations/capabilities/derive-operational-capabilities';
import {
  CONSERVATIVE_RELEASE_CAPABILITIES,
  deriveReleaseInteractionState,
  type ReleaseInteractionState,
} from '@/lib/operations/capabilities/derive-release-interaction-state';
import { isGraphReadyForProjection } from '@/lib/operations/coordination/derive-operational-readiness-state';
import { useOperationalGuidance } from '@/hooks/use-operational-guidance';
import { useWorkspaceActivation } from '@/hooks/use-workspace-activation';

/**
 * Client hook — merges server beta capabilities with live graph convergence state.
 */
export function useReleaseInteractionCapability(
  releaseCapabilities?: OperationalCapabilities
): ReleaseInteractionState {
  const { loading: activationLoading, operationalOnboarding, operationalInitialization } =
    useWorkspaceActivation();
  const { graphSnapshotConverged } = useOperationalGuidance();

  const operationalCapabilities = releaseCapabilities ?? CONSERVATIVE_RELEASE_CAPABILITIES;
  const graphReady = isGraphReadyForProjection(operationalOnboarding, operationalInitialization);

  return React.useMemo(
    () =>
      deriveReleaseInteractionState({
        operationalCapabilities,
        graphReady,
        graphSnapshotConverged,
        activationLoading,
      }),
    [
      activationLoading,
      graphSnapshotConverged,
      graphReady,
      operationalCapabilities.canCreateReleaseBatch,
      operationalCapabilities.canSubmitRelease,
      operationalCapabilities.canUseBetaSettlementFeatures,
      operationalCapabilities.disabledReason,
    ]
  );
}
