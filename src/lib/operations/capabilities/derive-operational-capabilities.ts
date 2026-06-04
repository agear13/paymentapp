export type OperationalCapabilities = {
  canCreateReleaseBatch: boolean;
  canSubmitRelease: boolean;
  canUseBetaSettlementFeatures: boolean;
  /** Read-only attribution earnings on Participant Earnings — independent of settlement beta lockdown. */
  canViewAttributionCommissions: boolean;
  disabledReason: string | null;
};

/**
 * Canonical release capability gating — UI must consult this before attempting release actions.
 */
export function deriveOperationalCapabilities(input: {
  isBetaAdmin: boolean;
  betaLockdownEnabled?: boolean;
  /**
   * When omitted, defaults to true (authenticated operator pages enforce view_payment_links separately).
   * Set false only when the user lacks org / view_payment_links.
   */
  canViewAttributionCommissions?: boolean;
}): OperationalCapabilities {
  const lockdown = input.betaLockdownEnabled !== false;
  const locked = lockdown && !input.isBetaAdmin;
  const canViewAttributionCommissions = input.canViewAttributionCommissions !== false;

  return {
    canCreateReleaseBatch: !locked,
    canSubmitRelease: !locked,
    canUseBetaSettlementFeatures: !locked,
    canViewAttributionCommissions,
    disabledReason: locked
      ? 'Payout release actions are limited to beta operators during preview.'
      : null,
  };
}
