import { deriveOperationalCapabilities } from '@/lib/operations/capabilities/derive-operational-capabilities';
import { deriveReleaseInteractionState } from '@/lib/operations/capabilities/derive-release-interaction-state';
import {
  isExpectedOperationalForbidden,
  shouldSuppressOperationalErrorToast,
} from '@/lib/operations/coordination/operational-fetch-guards';
import { safeObligationsProjection } from '@/lib/operations/coordination/safe-obligations-projection';
import { deriveOperationalReadinessState } from '@/lib/operations/coordination/derive-operational-readiness-state';
import { defaultWorkspaceContext } from '@/lib/operations/types/operational-context';
import { projectOperationalTimeline } from '@/lib/operations/timeline/project-operational-timeline';
import {
  assertPayoutSurfaceInvariants,
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

describe('participant earnings beta lockdown', () => {
  it('shows attribution commissions for normal operators while settlement stays beta-locked', () => {
    const state = deriveReleaseInteractionState({
      operationalCapabilities: betaLockedCaps,
      graphReady: true,
      graphSnapshotConverged: true,
    });
    expect(betaLockedCaps.canUseBetaSettlementFeatures).toBe(false);
    expect(state.canViewAttributionCommissions).toBe(true);
    expect(state.canQueryReferralCommissionLedger).toBe(false);
    expect(state.releaseInteractionEnabled).toBe(false);
    expect(state.disabledCategory).toBe('beta_locked');
  });

  it('enables attribution view while graph is still converging', () => {
    const state = deriveReleaseInteractionState({
      operationalCapabilities: betaLockedCaps,
      graphReady: false,
      graphSnapshotConverged: false,
    });
    expect(state.canViewAttributionCommissions).toBe(true);
    expect(state.canQueryReferralCommissionLedger).toBe(false);
    expect(state.releaseInteractionEnabled).toBe(false);
    expect(state.disabledCategory).toBe('settlement_initializing');
  });

  it('hides attribution when view_payment_links capability is denied on server caps', () => {
    const caps = deriveOperationalCapabilities({
      isBetaAdmin: false,
      betaLockdownEnabled: true,
      canViewAttributionCommissions: false,
    });
    const state = deriveReleaseInteractionState({
      operationalCapabilities: caps,
      graphReady: true,
      graphSnapshotConverged: true,
    });
    expect(state.canViewAttributionCommissions).toBe(false);
  });

  it('enables settlement ledger for beta admin when graph is ready', () => {
    const state = deriveReleaseInteractionState({
      operationalCapabilities: betaAdminCaps,
      graphReady: true,
      graphSnapshotConverged: true,
    });
    expect(state.canViewAttributionCommissions).toBe(true);
    expect(state.canQueryReferralCommissionLedger).toBe(true);
    expect(state.releaseInteractionEnabled).toBe(true);
  });

  it('does not treat beta 403 as unexpected when release interaction disabled', () => {
    const state = deriveReleaseInteractionState({
      operationalCapabilities: betaLockedCaps,
      graphReady: true,
      graphSnapshotConverged: true,
    });
    expect(state.canQueryReferralCommissionLedger).toBe(false);
    expect(isExpectedOperationalForbidden(403, state)).toBe(true);
    expect(
      shouldSuppressOperationalErrorToast({
        status: 403,
        message: 'Forbidden: This feature is restricted during beta',
        releaseInteraction: state,
      })
    ).toBe(true);
  });
});

describe('obligations safe projection during convergence', () => {
  const workspace = { ...defaultWorkspaceContext(), hasOrganization: true };

  it('shows initialization shell without fatal error state', () => {
    const readiness = deriveOperationalReadinessState({
      operationalOnboarding: { graphReady: false, phase: 'ONBOARDING_STARTED', blockers: [] } as never,
      graphSnapshotConverged: false,
      activationLoading: false,
      operationalCapabilities: betaLockedCaps,
      workspace,
    });
    const timeline = projectOperationalTimeline({ workspace, graphSnapshotConverged: false });
    const projection = safeObligationsProjection({
      readiness,
      settlementShowShell: true,
      timelineProjection: timeline,
      nextActions: [],
      obligationsAvailable: false,
    });
    expect(projection.showInitializationShell).toBe(true);
    expect(projection.canLoadObligations).toBe(false);
    expect(projection.headline).toMatch(/initializ/i);
  });

  it('degrades gracefully when load fails during convergence', () => {
    const readiness = deriveOperationalReadinessState({
      operationalOnboarding: { graphReady: true, phase: 'OPERATIONAL_GRAPH_READY', blockers: [] } as never,
      graphSnapshotConverged: false,
      activationLoading: false,
      operationalCapabilities: betaLockedCaps,
      workspace,
    });
    const timeline = projectOperationalTimeline({ workspace, graphSnapshotConverged: false });
    const projection = safeObligationsProjection({
      readiness,
      settlementShowShell: false,
      timelineProjection: timeline,
      nextActions: [{ id: 'a1', action: 'Connect Stripe', reason: 'Rails required', impact: '', urgency: 'high', destination: '/settings' }],
      loadError: null,
      obligationsAvailable: false,
    });
    expect(projection.degraded).toBe(true);
    expect(projection.guidance).not.toMatch(/unavailable/i);
  });
});

describe('payout surface invariants', () => {
  it('throws when forbidden toast fires during expected disabled state in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertPayoutSurfaceInvariants({ forbiddenToastDuringExpectedDisabled: true })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });
});
