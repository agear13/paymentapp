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
  it('enables attribution commission ledger for beta admin when graph is ready', () => {
    const state = deriveReleaseInteractionState({
      operationalCapabilities: betaAdminCaps,
      graphReady: true,
      graphSnapshotConverged: true,
    });
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
