export type OperationalCapabilities = {
  canCreateReleaseBatch: boolean;
  canSubmitRelease: boolean;
  canUseBetaSettlementFeatures: boolean;
  disabledReason: string | null;
};

/**
 * Canonical release capability gating — UI must consult this before attempting release actions.
 */
export function deriveOperationalCapabilities(input: {
  isBetaAdmin: boolean;
  betaLockdownEnabled?: boolean;
}): OperationalCapabilities {
  const lockdown = input.betaLockdownEnabled !== false;
  const locked = lockdown && !input.isBetaAdmin;

  return {
    canCreateReleaseBatch: !locked,
    canSubmitRelease: !locked,
    canUseBetaSettlementFeatures: !locked,
    disabledReason: locked
      ? 'Payout release actions are limited to beta operators during preview.'
      : null,
  };
}
