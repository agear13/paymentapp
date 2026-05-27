import { deriveCompensationPreviewText } from '@/lib/operations/derivations/commission-scope';
import { resolveOperationalWorkspaceCurrency } from '@/lib/currency/resolve-operational-workspace-currency';
import { deriveReleaseInteractionState } from '@/lib/operations/capabilities/derive-release-interaction-state';
import { deriveOperationalCapabilities } from '@/lib/operations/capabilities/derive-operational-capabilities';
import { deriveOperationalNextActions } from '@/lib/operations/explainability/derive-operational-next-actions';
import { guidanceFromOperationalGraph } from '@/lib/operations/selectors/operational-graph-adapter';
import { defaultWorkspaceContext } from '@/lib/operations/types/operational-context';
import { emptyOperationalGraphSummary } from '@/lib/operations/selectors/operational-coordination-snapshot';
import {
  assertCompensationCurrencyInvariants,
  assertBetaReleaseErrorInvariants,
  assertOperationalProjectionInvariants,
  assertOnboardingGuidanceInvariants,
  OperationalInvariantViolation,
} from '@/lib/operations/dev/operational-invariants';
import { hydrateOperationalParticipant } from '@/lib/operations/hydration/hydrate-operational-participant';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

describe('operational convergence integrity', () => {
  describe('1A — compensation currency', () => {
    it('resolves USD from project currency over platform fallback', () => {
      expect(
        resolveOperationalWorkspaceCurrency({
          projectCurrency: 'USD',
          workspaceDefaultCurrency: 'AUD',
        })
      ).toBe('USD');
    });

    it('renders fixed compensation preview in workspace currency', () => {
      const participant = hydrateOperationalParticipant({
        id: 'p-1',
        name: 'Alex',
        compensationProfile: {
          compensationType: 'FIXED_FEE',
          fixedAmount: 2500,
          configured: true,
          revenueSources: [],
          customerAttributionEnabled: false,
          commissionSourceMode: 'all_active',
          commissionServiceIds: [],
        },
      } as DemoParticipant);

      const preview = deriveCompensationPreviewText(participant, {
        workspaceCurrency: 'USD',
      });
      expect(preview).toMatch(/\$2,500/);
      expect(preview).not.toMatch(/A\$/);
    });

    it('throws COMPENSATION_CURRENCY_CONTRADICTS_WORKSPACE_CURRENCY in development', () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      expect(() =>
        assertCompensationCurrencyInvariants({
          workspaceCurrency: 'USD',
          renderedCurrency: 'AUD',
          compensationConfigured: true,
        })
      ).toThrow(OperationalInvariantViolation);
      process.env.NODE_ENV = prev;
    });
  });

  describe('1B — beta release interaction', () => {
    it('prevents release history queries during beta lockdown after convergence', () => {
      const state = deriveReleaseInteractionState({
        operationalCapabilities: deriveOperationalCapabilities({
          isBetaAdmin: false,
          betaLockdownEnabled: true,
        }),
        graphReady: true,
        graphSnapshotConverged: true,
      });
      expect(state.canQueryReleaseHistory).toBe(false);
      expect(state.disabledCategory).toBe('beta_locked');
    });

    it('throws EXPECTED_BETA_LOCKDOWN_TRIGGERED_FATAL_RELEASE_ERROR in development', () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      expect(() =>
        assertBetaReleaseErrorInvariants({
          expectedBetaLockdown: true,
          fatalReleaseErrorObserved: true,
          releaseInteractionEnabled: false,
        })
      ).toThrow(OperationalInvariantViolation);
      process.env.NODE_ENV = prev;
    });
  });

  describe('1C — projection safety', () => {
    it('guidanceFromOperationalGraph tolerates partial participant hydration', () => {
      const snapshot = {
        participants: [
          {
            participantId: 'p-1',
            readinessHierarchy: {
              participant: { ready: false, blockers: [] },
              obligation: { ready: false, blockers: [] },
              funding: { ready: false, blockers: [] },
              release: { ready: false, blockers: [] },
              releaseReady: false,
            },
          },
        ],
        obligations: [],
        summary: emptyOperationalGraphSummary(),
        funding: { allocated: false, stage: null },
      };

      expect(() =>
        guidanceFromOperationalGraph({
          snapshot: snapshot as Parameters<typeof guidanceFromOperationalGraph>[0]['snapshot'],
          workspace: defaultWorkspaceContext(),
          graphReady: true,
          graphSnapshotConverged: true,
        })
      ).not.toThrow();
    });

    it('throws OPERATIONAL_PROJECTION_THROW_DURING_EXPECTED_INITIALIZATION in development', () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      expect(() =>
        assertOperationalProjectionInvariants({
          projectionThrew: true,
          expectedInitializationWindow: true,
        })
      ).toThrow(OperationalInvariantViolation);
      process.env.NODE_ENV = prev;
    });
  });

  describe('1D — actionable onboarding guidance', () => {
    it('surfaces configure earnings as next step after rails connect', () => {
      const workspace = {
        ...defaultWorkspaceContext(),
        participantCount: 3,
        participantsConfiguredCount: 1,
        stripeConfigured: true,
        primaryProjectId: 'proj-1',
      };
      const actions = deriveOperationalNextActions({
        explanation: {
          readinessLevel: 'partial',
          readinessScore: 40,
          blockers: [],
          warnings: [],
          confidence: 'MEDIUM',
          missingRequirements: [],
          nextRecommendedActions: [],
          explainability: { headline: 'Coordination in progress', bullets: [] },
          trustState: 'attention',
          phaseLabel: 'Stripe connected',
          scopeTitle: 'Workspace',
        },
        workspace,
        graphReady: true,
        graphSnapshotConverged: true,
        operationalOnboarding: {
          phase: 'STRIPE_CONNECTED',
          workspaceReady: true,
          projectReady: true,
          paymentRailsReady: true,
          stripeConnected: true,
          graphReady: true,
          blockers: [],
          pendingInitializationSteps: [],
          primaryProjectId: 'proj-1',
          organizationId: 'org-1',
          merchantSettingsId: 'ms-1',
          recoveryMessage: null,
          correlationId: 'corr-1',
        },
      });

      expect(actions[0]?.action).toMatch(/Configure earnings/i);
    });

    it('throws ONBOARDING_GUIDANCE_MISSING_NEXT_ACTION in development', () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      expect(() =>
        assertOnboardingGuidanceInvariants({
          hasStripeConnected: true,
          graphReady: true,
          graphSnapshotConverged: true,
          participantCount: 2,
          nextActionCount: 0,
        })
      ).toThrow(OperationalInvariantViolation);
      process.env.NODE_ENV = prev;
    });
  });
});
