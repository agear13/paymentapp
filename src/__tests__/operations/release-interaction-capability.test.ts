import { deriveOperationalCapabilities } from '@/lib/operations/capabilities/derive-operational-capabilities';
import { deriveReleaseInteractionState } from '@/lib/operations/capabilities/derive-release-interaction-state';
import {
  assertReleaseInteractionInvariants,
  OperationalInvariantViolation,
} from '@/lib/operations/dev/operational-invariants';

const betaLockedCaps = deriveOperationalCapabilities({
  isBetaAdmin: false,
  betaLockdownEnabled: true,
});

const betaAdminCaps = deriveOperationalCapabilities({
  isBetaAdmin: true,
  betaLockdownEnabled: true,
});

describe('release interaction capability convergence', () => {
  it('disables interaction while activation is loading', () => {
    const state = deriveReleaseInteractionState({
      operationalCapabilities: betaAdminCaps,
      graphReady: true,
      graphSnapshotConverged: true,
      activationLoading: true,
    });
    expect(state.releaseInteractionEnabled).toBe(false);
    expect(state.canQueryReleaseHistory).toBe(false);
    expect(state.disabledCategory).toBe('activation_loading');
  });

  it('disables interaction when settlement graph is not ready', () => {
    const state = deriveReleaseInteractionState({
      operationalCapabilities: betaAdminCaps,
      graphReady: false,
      graphSnapshotConverged: false,
    });
    expect(state.releaseInteractionEnabled).toBe(false);
    expect(state.interactionGuidance).toMatch(/converging/i);
    expect(state.disabledCategory).toBe('settlement_initializing');
  });

  it('disables interaction when graph is ready but snapshot is unconverged', () => {
    const state = deriveReleaseInteractionState({
      operationalCapabilities: betaAdminCaps,
      graphReady: true,
      graphSnapshotConverged: false,
    });
    expect(state.releaseInteractionEnabled).toBe(false);
    expect(state.canPreviewReleaseEligibility).toBe(false);
    expect(state.disabledCategory).toBe('graph_converging');
  });

  it('disables interaction for beta-locked operators after convergence', () => {
    const state = deriveReleaseInteractionState({
      operationalCapabilities: betaLockedCaps,
      graphReady: true,
      graphSnapshotConverged: true,
    });
    expect(state.releaseInteractionEnabled).toBe(false);
    expect(state.canCreateReleaseBatch).toBe(false);
    expect(state.canQueryReferralCommissionLedger).toBe(false);
    expect(state.disabledCategory).toBe('beta_locked');
    expect(state.interactionGuidance).toMatch(/beta/i);
  });

  it('enables interaction for beta admins after full convergence', () => {
    const state = deriveReleaseInteractionState({
      operationalCapabilities: betaAdminCaps,
      graphReady: true,
      graphSnapshotConverged: true,
    });
    expect(state.releaseInteractionEnabled).toBe(true);
    expect(state.canQueryReleaseHistory).toBe(true);
    expect(state.canQueryReferralCommissionLedger).toBe(true);
    expect(state.canCreateReleaseBatch).toBe(true);
    expect(state.disabledReason).toBeNull();
  });

  it('throws when interaction is enabled before graph convergence in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertReleaseInteractionInvariants({
        releaseInteractionEnabled: true,
        graphSnapshotConverged: false,
      })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });

  it('throws when a mutation is attempted during expected initialization in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertReleaseInteractionInvariants({
        expectedInitializationWindow: true,
        mutationAttempted: true,
      })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });

  it('throws when interactive release action renders while capability disabled in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertReleaseInteractionInvariants({
        releaseInteractionEnabled: false,
        releaseActionEnabled: true,
      })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });

  it('throws when beta-disabled mutation is attempted in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertReleaseInteractionInvariants({
        releaseInteractionEnabled: false,
        mutationAttempted: true,
      })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });

  it('throws when rendered action contradicts beta capability in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertReleaseInteractionInvariants({
        releaseActionEnabled: true,
        canCreateReleaseBatch: false,
        betaSettlementAllowed: false,
      })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });
});
