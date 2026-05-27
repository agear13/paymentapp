import { resolveOperationalOnboardingState } from '@/lib/operations/onboarding/resolve-operational-onboarding-state.server';
import {
  ensureSettlementRailsInitialized,
} from '@/lib/operations/onboarding/operational-onboarding-barriers.server';
import { deriveOperationalBlockingActions } from '@/lib/operations/explainability/derive-operational-blocking-actions';
import { getOperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import {
  assertOnboardingGraphInvariants,
  OperationalInvariantViolation,
} from '@/lib/operations/dev/operational-invariants';
import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { onboardingInitializationProgress, isOperationalGraphReady } from '@/lib/operations/onboarding/operational-onboarding-phases';
import {
  parseCoordinationSnapshotProjection,
  emptyOperationalGraphSummary,
} from '@/lib/operations/selectors/operational-coordination-snapshot';
import { guidanceFromOperationalGraph } from '@/lib/operations/selectors/operational-graph-adapter';
import { defaultWorkspaceContext } from '@/lib/operations/types/operational-context';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    user_organizations: { findFirst: jest.fn().mockResolvedValue(null) },
    merchant_settings: { findFirst: jest.fn().mockResolvedValue(null) },
    operational_onboarding_transitions: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
  },
}));

jest.mock('@/lib/deal-network-demo/pilot-snapshot.server', () => ({
  getPilotSnapshotForUser: jest.fn().mockResolvedValue({ deals: [], participants: [] }),
}));

function baseDeal(id = 'onb-deal-test'): RecentDeal {
  return {
    id,
    dealName: 'Onboarding Project',
    partner: 'Test',
    value: 5000,
    introducer: '—',
    closer: '—',
    status: 'Pending',
    lastUpdated: new Date().toISOString(),
    paymentStatus: 'Not Paid',
    setupStatus: 'configuring',
    projectValueCurrency: 'AUD',
  } as RecentDeal;
}

describe('operational onboarding readiness', () => {
  it('starts at ONBOARDING_STARTED without organization context', async () => {
    const state = await resolveOperationalOnboardingState({
      userId: '00000000-0000-0000-0000-000000000099',
      organizationId: null,
      orchestrate: false,
    });
    expect(state.phase).toBe('ONBOARDING_STARTED');
    expect(state.graphReady).toBe(false);
    expect(isOperationalGraphReady(state.phase)).toBe(false);
  });

  it('ensureSettlementRailsInitialized is false without organization', async () => {
    const rails = await ensureSettlementRailsInitialized(null);
    expect(rails.ready).toBe(false);
    expect(rails.stripeConnected).toBe(false);
  });
});

describe('onboarding graph safety', () => {
  it('deriveOperationalBlockingActions tolerates API-shaped participant rows without nested participant', () => {
    const snapshot = getOperationalCoordinationSnapshot({
      participants: [buildProjectParticipant({
        name: 'Alex',
        role: 'Contributor',
        project: baseDeal(),
        participationModel: 'fixed_payout',
        commissionKind: 'fixed_amount',
        commissionValue: 100,
        enableCustomerAttribution: false,
      })],
      projectId: 'onb-deal-test',
      fundingAllocated: false,
      funding: {
        fundingSourceConnected: true,
        confirmedFunding: 0,
        obligationsTotal: 100,
        obligationsFunded: 0,
      },
    });

    const apiShaped = {
      ...snapshot,
      participants: snapshot.participants.map((p) => ({
        participantId: p.participant.id,
        name: p.participant.name,
        readinessHierarchy: p.readinessHierarchy,
        blockers: p.blockers,
      })) as unknown as typeof snapshot.participants,
    };

    const blocking = deriveOperationalBlockingActions(apiShaped);
    expect(blocking.blockers.length).toBeGreaterThan(0);
  });

  it('throws GRAPH_PROJECTION_BEFORE_BOOTSTRAP in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertOnboardingGraphInvariants({ graphProjectionBeforeBootstrap: true })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });

  it('throws OPERATIONAL_GRAPH_RESOLUTION_BEFORE_INITIALIZATION when graph not ready', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertOnboardingGraphInvariants({
        graphResolutionAttempted: true,
        projectId: 'proj-1',
        graphReady: false,
      })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });

  it('onboardingInitializationProgress reflects partial stripe-connected state', () => {
    const progress = onboardingInitializationProgress({
      phase: 'STRIPE_CONNECTED',
      workspaceReady: true,
      projectReady: true,
      paymentRailsReady: true,
      stripeConnected: true,
      graphReady: false,
      blockers: ['Operational graph not yet ready'],
      pendingInitializationSteps: ['Initialize operational coordination'],
      primaryProjectId: 'proj-1',
      organizationId: 'org-1',
      merchantSettingsId: 'ms-1',
      recoveryMessage:
        'Settlement infrastructure is still initializing. Your payment rails were connected successfully. Operational coordination is being prepared.',
      correlationId: 'onb-test',
    });
    expect(progress.steps.find((s: { id: string }) => s.id === 'graph')?.complete).toBe(false);
    expect(progress.steps.find((s: { id: string }) => s.id === 'stripe')?.complete).toBe(true);
  });

  it('parseCoordinationSnapshotProjection rejects pre-ready null summary (Stripe redirect window)', () => {
    const projection = parseCoordinationSnapshotProjection({
      graphReady: false,
      summary: null,
      funding: null,
      participants: [],
    });
    expect(projection).toBeNull();
  });

  it('parseCoordinationSnapshotProjection accepts degraded empty summary when explicitly not ready', () => {
    const projection = parseCoordinationSnapshotProjection({
      graphReady: false,
      summary: emptyOperationalGraphSummary(),
      funding: { allocated: false, stage: null },
      participants: [],
    });
    expect(projection).toBeNull();
  });

  it('guidanceFromOperationalGraph does not throw when summary uses empty degraded shape', () => {
    const snapshot = {
      participants: [],
      obligations: [],
      summary: emptyOperationalGraphSummary(),
      funding: { allocated: false, stage: null },
    };
    expect(() =>
      guidanceFromOperationalGraph({
        snapshot,
        workspace: defaultWorkspaceContext(),
      })
    ).not.toThrow();
    const bundle = guidanceFromOperationalGraph({
      snapshot,
      workspace: defaultWorkspaceContext(),
    });
    expect(bundle.releaseConfidence.readyToRelease).toBe(0);
  });

  it('throws GRAPH_SUMMARY_CONSUMED_BEFORE_READY in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertOnboardingGraphInvariants({ graphSummaryConsumedBeforeReady: true })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });

  it('guidanceFromOperationalGraph with graphReady false returns initializing blockers without throwing', () => {
    const snapshot = {
      participants: [],
      obligations: [],
      summary: emptyOperationalGraphSummary(),
      funding: { allocated: false, stage: null },
    };
    expect(() =>
      guidanceFromOperationalGraph({
        snapshot,
        workspace: defaultWorkspaceContext(),
        graphReady: false,
        initializationRecoveryMessage: 'Coordination snapshot still converging.',
      })
    ).not.toThrow();
    const bundle = guidanceFromOperationalGraph({
      snapshot,
      workspace: defaultWorkspaceContext(),
      graphReady: false,
      initializationRecoveryMessage: 'Coordination snapshot still converging.',
    });
    expect(bundle.degraded).toBe(false);
    expect(bundle.releaseBlockers[0]?.category).toBe('operational_graph_initializing');
    expect(bundle.releaseConfidence.level).toBe('BLOCKED');
  });

  it('guidanceFromOperationalGraph tolerates API-shaped participant projections before full hydration', () => {
    const snapshot = {
      participants: [
        {
          participantId: 'p-1',
          name: 'Alex',
          agreementApproval: 'participant_approved',
          payoutReady: true,
          releaseReady: false,
          readinessHierarchy: {
            participant: { ready: true, blockers: [] },
            obligation: { ready: true, blockers: [] },
            funding: { ready: false, blockers: ['Awaiting funding allocation'] },
            release: { ready: false, blockers: ['Funding not allocated'] },
            releaseReady: false,
          },
          blockers: [],
        },
      ] as unknown as ReturnType<typeof getOperationalCoordinationSnapshot>['participants'],
      obligations: [],
      summary: {
        participantCount: 1,
        payoutReadyCount: 1,
        releaseReadyCount: 0,
        blockerCount: 1,
        allBlockers: [],
      },
      funding: { allocated: false, stage: { blockerLabel: 'Funding not confirmed' } },
    };
    expect(() =>
      guidanceFromOperationalGraph({
        snapshot,
        workspace: {
          ...defaultWorkspaceContext(),
          participantCount: 1,
          participantsConfiguredCount: 1,
          primaryProjectId: 'proj-1',
          stripeConfigured: true,
        },
      })
    ).not.toThrow();
  });
});
