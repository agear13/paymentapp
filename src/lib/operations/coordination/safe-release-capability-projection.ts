import {
  deriveReleaseInteractionState,
  type ReleaseInteractionInput,
  type ReleaseInteractionState,
} from '@/lib/operations/capabilities/derive-release-interaction-state';

/** Guarded release capability projection — never throws. */
export function safeReleaseCapabilityProjection(
  input: ReleaseInteractionInput
): ReleaseInteractionState {
  try {
    return deriveReleaseInteractionState(input);
  } catch {
    return deriveReleaseInteractionState({
      ...input,
      operationalCapabilities: {
        canCreateReleaseBatch: false,
        canSubmitRelease: false,
        canUseBetaSettlementFeatures: false,
        canViewAttributionCommissions: true,
        disabledReason: 'Release capabilities are still loading.',
      },
      activationLoading: true,
    });
  }
}
