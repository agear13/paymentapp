/** Temporary production diagnostics for Participant Earnings attribution gate. */

export type AttributionRuntimeDiagPayload = {
  isBetaAdmin: boolean;
  canUseBetaSettlementFeatures: boolean;
  canViewAttributionCommissions: boolean;
  canQueryReferralCommissionLedger: boolean | null;
  releaseInteractionEnabled: boolean | null;
  graphReady: boolean | null;
  graphSnapshotConverged: boolean | null;
  releaseCapabilitiesPassedToWorkspace: boolean;
};

export const ATTRIBUTION_RUNTIME_DIAG_TAG = '[ATTRIBUTION_RUNTIME_DIAG]';

export function logAttributionRuntimeDiag(
  surface: 'PayoutsCommissionsPage(server)' | 'OperatorCommissionsWorkspace(client)',
  payload: AttributionRuntimeDiagPayload
): void {
  console.info(ATTRIBUTION_RUNTIME_DIAG_TAG, { surface, ...payload });
}
