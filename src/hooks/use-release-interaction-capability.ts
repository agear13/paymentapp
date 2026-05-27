'use client';

import * as React from 'react';
import type { OperationalCapabilities } from '@/lib/operations/capabilities/derive-operational-capabilities';
import {
  CONSERVATIVE_RELEASE_CAPABILITIES,
  deriveReleaseInteractionState,
  type ReleaseInteractionState,
} from '@/lib/operations/capabilities/derive-release-interaction-state';
import { useOperationalGuidance } from '@/hooks/use-operational-guidance';
import { useWorkspaceActivation } from '@/hooks/use-workspace-activation';

/**
 * Client hook — merges server beta capabilities with live graph convergence state.
 */
export function useReleaseInteractionCapability(
  releaseCapabilities?: OperationalCapabilities
): ReleaseInteractionState {
  const { loading: activationLoading, operationalOnboarding } = useWorkspaceActivation();
  const { graphSnapshotConverged } = useOperationalGuidance();

  const operationalCapabilities = releaseCapabilities ?? CONSERVATIVE_RELEASE_CAPABILITIES;

  return React.useMemo(
    () =>
      deriveReleaseInteractionState({
        operationalCapabilities,
        graphReady: operationalOnboarding?.graphReady === true,
        graphSnapshotConverged,
        activationLoading,
      }),
    [
      activationLoading,
      graphSnapshotConverged,
      operationalCapabilities.canCreateReleaseBatch,
      operationalCapabilities.canSubmitRelease,
      operationalCapabilities.canUseBetaSettlementFeatures,
      operationalCapabilities.disabledReason,
      operationalOnboarding?.graphReady,
    ]
  );
}
