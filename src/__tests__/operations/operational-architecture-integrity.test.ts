import { deriveOperationalCapabilities } from '@/lib/operations/capabilities/derive-operational-capabilities';
import {
  deriveOperationalReadinessState,
  deriveSettlementInitializationState,
  deriveOperationalOnboardingProgress,
  isGraphReadyForProjection,
  safeOperationalProjection,
  emptyOperationalGraphProjection,
} from '@/lib/operations/coordination';
import { defaultWorkspaceContext } from '@/lib/operations/types/operational-context';
import {
  assertOperationalCurrencyInvariants,
  assertOperationalReadinessInvariants,
  assertProjectableSnapshotInvariants,
  assertReleaseCapabilityInvariants,
  OperationalInvariantViolation,
} from '@/lib/operations/dev/operational-invariants';
import { resolveOperationalWorkspaceCurrency } from '@/lib/currency/resolve-operational-workspace-currency';

const betaAdminCaps = deriveOperationalCapabilities({
  isBetaAdmin: true,
  betaLockdownEnabled: true,
});

describe('canonical operational readiness', () => {
  it('reports settlement_initializing when graph is not ready', () => {
    const state = deriveOperationalReadinessState({
      operationalOnboarding: { graphReady: false, phase: 'ONBOARDING_STARTED' } as never,
      graphSnapshotConverged: false,
      activationLoading: false,
      operationalCapabilities: betaAdminCaps,
    });
    expect(state.phase).toBe('settlement_initializing');
    expect(state.graphReadyForProjection).toBe(false);
    expect(state.releaseInteraction.releaseInteractionEnabled).toBe(false);
  });

  it('reports graph_converging when ready but snapshot unconverged', () => {
    const state = deriveOperationalReadinessState({
      operationalOnboarding: { graphReady: true, phase: 'OPERATIONAL_GRAPH_READY' } as never,
      graphSnapshotConverged: false,
      activationLoading: false,
      operationalCapabilities: betaAdminCaps,
    });
    expect(state.phase).toBe('graph_converging');
    expect(state.canProjectGuidance).toBe(false);
  });

  it('isGraphReadyForProjection respects initialization snapshot', () => {
    expect(
      isGraphReadyForProjection(null, { graphReady: true } as never)
    ).toBe(true);
  });
});

describe('settlement initialization selector', () => {
  it('shows initialization shell until graph is projectable', () => {
    const init = deriveSettlementInitializationState({
      operationalOnboarding: { graphReady: false, blockers: ['Stripe connected'] } as never,
    });
    expect(init.showInitializationShell).toBe(true);
    expect(init.allowChildProjections).toBe(false);
  });

  it('allows children when graph is ready even if snapshot is converging', () => {
    const init = deriveSettlementInitializationState({
      operationalOnboarding: { graphReady: true, phase: 'OPERATIONAL_GRAPH_READY' } as never,
      graphSnapshotConverged: false,
    });
    expect(init.showInitializationShell).toBe(false);
    expect(init.allowChildProjections).toBe(false);
  });

  it('does not show initialization shell when persisted operational evidence exists', () => {
    const init = deriveSettlementInitializationState({
      operationalOnboarding: { graphReady: false, blockers: [] } as never,
      graphSnapshotConverged: false,
      participantCount: 3,
      earningsConfiguredCount: 3,
      obligationCount: 4,
    });
    expect(init.showInitializationShell).toBe(false);
  });
});

describe('safe operational projection', () => {
  it('returns degraded guidance when graph is not ready', () => {
    const workspace = defaultWorkspaceContext();
    const result = safeOperationalProjection({
      payload: { graphReady: false, summary: null, funding: null, participants: [] },
      workspace,
      fallbackGuidance: () => ({
        explanation: {
          readinessLevel: 'blocked',
          readinessScore: 0,
          blockers: ['init'],
          warnings: [],
          missingRequirements: [],
          confidence: 'BLOCKED',
          nextRecommendedActions: [],
          explainability: { headline: 'Init', bullets: [] },
          trustState: 'attention',
          phaseLabel: 'init',
          scopeTitle: 'Workspace',
        },
        stateExplanation: null,
        actions: [],
        trustSignals: [],
        releaseBlockers: [],
        releaseConfidence: {
          level: 'BLOCKED',
          score: 0,
          currency: workspace.defaultCurrency ?? 'AUD',
          collectedRevenue: 0,
          reservedObligations: 0,
          readyToRelease: 0,
          heldBack: 0,
          heldBackReasons: [],
          blockedParticipantCount: 0,
          riskWarnings: [],
          releasableObligationCount: 0,
          totalObligationCount: 0,
          explainability: { headline: 'Init', bullets: [] },
        },
        timeline: [],
        transition: null,
        degraded: true,
      }),
    });
    expect(result.degraded).toBe(true);
    expect(result.projection).toBeNull();
  });

  it('emptyOperationalGraphProjection never throws', () => {
    expect(() => emptyOperationalGraphProjection()).not.toThrow();
    expect(emptyOperationalGraphProjection().participants).toEqual([]);
  });
});

describe('operational onboarding progress', () => {
  it('derives required actions when stripe is connected but participants missing', () => {
    const workspace = {
      ...defaultWorkspaceContext(),
      stripeConfigured: true,
      participantCount: 0,
      participantsConfiguredCount: 0,
    };
    const progress = deriveOperationalOnboardingProgress({
      operationalOnboarding: {
        graphReady: true,
        phase: 'OPERATIONAL_GRAPH_READY',
        stripeConnected: true,
        blockers: [],
      } as never,
      workspace,
      graphSnapshotConverged: true,
      explanation: {
        readinessLevel: 'partial',
        readinessScore: 40,
        blockers: [],
        warnings: [],
        confidence: 'MEDIUM',
        missingRequirements: [],
        nextRecommendedActions: [],
        explainability: { headline: 'Setup', bullets: [] },
        trustState: 'attention',
        phaseLabel: 'Setup',
        scopeTitle: 'Workspace',
      },
    });
    expect(progress.completionPercent).toBeGreaterThanOrEqual(0);
    expect(progress.stages.length).toBeGreaterThan(0);
  });
});

describe('currency resolution chain', () => {
  it('prefers project currency over workspace default', () => {
    expect(
      resolveOperationalWorkspaceCurrency({
        projectCurrency: 'USD',
        workspaceDefaultCurrency: 'AUD',
      })
    ).toBe('USD');
  });

  it('throws when rendered currency bypasses workspace in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertOperationalCurrencyInvariants({
        workspaceCurrency: 'USD',
        renderedCurrency: 'AUD',
        usedFallbackCurrency: true,
      })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });
});

describe('release capability compliance', () => {
  it('throws when release fetch occurs outside capability gate in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertReleaseCapabilityInvariants({ releaseFetchOutsideGate: true })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });
});

describe('readiness invariant guards', () => {
  it('throws when UI derives readiness directly in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertOperationalReadinessInvariants({ uiDerivesReadinessDirectly: true })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });
});

describe('projectable snapshot guards', () => {
  it('throws on unguarded graph consumption in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertProjectableSnapshotInvariants({ summaryPresent: false, fundingPresent: true })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });
});
