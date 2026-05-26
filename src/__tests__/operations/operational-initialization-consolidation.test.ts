import {
  createOperationalCorrelationId,
  pendingTransitionsAfter,
} from '@/lib/operations/onboarding/operational-transition-types';
import { deriveAuditTimelineFromTransitions } from '@/lib/operations/audit/derive-audit-timeline-from-transitions';
import {
  assertConvergenceInvariants,
  OperationalInvariantViolation,
} from '@/lib/operations/dev/operational-invariants';
import { buildOperationalOnboardingState } from '@/lib/operations/onboarding/build-operational-onboarding-state.server';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    user_organizations: { findFirst: jest.fn().mockResolvedValue(null) },
    merchant_settings: { findFirst: jest.fn().mockResolvedValue(null) },
    operational_onboarding_transitions: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'tx-1',
          organization_id: data.organization_id,
          project_id: data.project_id,
          record_kind: data.record_kind,
          phase: data.phase,
          previous_phase: data.previous_phase,
          status: data.status,
          started_at: new Date(),
          completed_at: data.completed_at ?? null,
          failed_at: data.failed_at ?? null,
          correlation_id: data.correlation_id,
          trigger_source: data.trigger_source,
          user_id: data.user_id,
          metadata: data.metadata ?? null,
          orchestration_event_id: data.orchestration_event_id ?? null,
        })
      ),
    },
  },
}));

jest.mock('@/lib/deal-network-demo/pilot-snapshot.server', () => ({
  getPilotSnapshotForUser: jest.fn().mockResolvedValue({ deals: [], participants: [] }),
}));

describe('operational initialization consolidation', () => {
  it('createOperationalCorrelationId produces unique trace ids', () => {
    const a = createOperationalCorrelationId();
    const b = createOperationalCorrelationId();
    expect(a).not.toEqual(b);
    expect(a.startsWith('onb-')).toBe(true);
  });

  it('pendingTransitionsAfter excludes completed phases', () => {
    const pending = pendingTransitionsAfter([
      'WORKSPACE_CREATED',
      'PROJECT_BOOTSTRAPPED',
    ]);
    expect(pending).toContain('PAYMENT_RAIL_INITIALIZED');
    expect(pending).not.toContain('WORKSPACE_CREATED');
  });

  it('deriveAuditTimelineFromTransitions maps workspace and graph events', () => {
    const timeline = deriveAuditTimelineFromTransitions([
      {
        id: '1',
        organizationId: 'org-1',
        projectId: null,
        recordKind: 'bootstrap_event',
        phase: 'WORKSPACE_CREATED',
        previousPhase: null,
        status: 'completed',
        startedAt: '2026-01-01T00:00:00.000Z',
        completedAt: '2026-01-01T00:00:01.000Z',
        failedAt: null,
        correlationId: 'onb-test',
        triggerSource: 'bootstrap-workspace',
        userId: 'user-1',
        metadata: null,
        orchestrationEventId: null,
      },
      {
        id: '2',
        organizationId: 'org-1',
        projectId: 'proj-1',
        recordKind: 'graph_initialization',
        phase: 'OPERATIONAL_GRAPH_READY',
        previousPhase: 'OPERATIONAL_GRAPH_INITIALIZATION_STARTED',
        status: 'completed',
        startedAt: '2026-01-01T00:00:02.000Z',
        completedAt: '2026-01-01T00:00:03.000Z',
        failedAt: null,
        correlationId: 'onb-test',
        triggerSource: 'merchant-settings-patch',
        userId: 'user-1',
        metadata: null,
        orchestrationEventId: null,
      },
    ]);
    const types = timeline.map((e) => e.type);
    expect(types).toContain('workspace_created');
    expect(types).toContain('operational_graph_initialized');
    expect(timeline).toHaveLength(2);
  });

  it('buildOperationalOnboardingState derives STRIPE_CONNECTED without graph', () => {
    const state = buildOperationalOnboardingState({
      workspace: { ready: true, organizationId: 'org-1', merchantSettingsId: 'ms-1' },
      project: { ready: true, projectId: 'proj-1' },
      rails: { ready: true, stripeConnected: true },
      graphReady: false,
      blockers: ['Operational graph not yet ready'],
      organizationId: 'org-1',
      merchantSettingsId: 'ms-1',
      correlationId: 'onb-test',
    });
    expect(state.phase).toBe('STRIPE_CONNECTED');
    expect(state.graphReady).toBe(false);
    expect(state.recoveryMessage).toContain('Settlement infrastructure is still initializing');
  });
});

describe('convergence invariants', () => {
  it('throws MULTIPLE_ACTIVE_INITIALIZATION_CHAINS in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertConvergenceInvariants({ multipleActiveInitializationChains: true })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });

  it('throws GRAPH_READY_WITHOUT_SETTLEMENT_RAILS in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertConvergenceInvariants({ graphReadyWithoutSettlementRails: true })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });
});
