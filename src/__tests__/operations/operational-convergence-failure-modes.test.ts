import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { buildPersistedCoordinationSnapshot } from '@/lib/operations/selectors/build-persisted-coordination-snapshot';
import { getOperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import { emptyOperationalGraphProjection } from '@/lib/operations/coordination/safe-operational-projection';
import { hasPersistedOperationalEntities } from '@/lib/operations/selectors/build-persisted-coordination-snapshot';
import {
  applyOperationalSyncConvergence,
  OPERATIONAL_CONVERGENCE_PHASE_ORDER,
  resetOperationalConvergenceQueueForTests,
  type OperationalSyncHandlers,
} from '@/lib/operations/orchestration/operational-sync-convergence';
import {
  dispatchOperationalEvent,
  resetOperationalEventBusForTests,
  subscribeOperationalEvents,
} from '@/lib/operations/orchestration/operational-event-bus';
import { withConvergenceTimeout } from '@/lib/operations/orchestration/operational-convergence-resilience';
import {
  getRecentOperationalTelemetry,
  resetOperationalTelemetryForTests,
} from '@/lib/operations/telemetry/operational-telemetry';
import { assertPostConvergenceIntegrity } from '@/lib/operations/dev/assert-post-convergence-integrity';
import { OperationalInvariantViolation } from '@/lib/operations/dev/operational-invariants';

function readyParticipant(id: string): DemoParticipant {
  return {
    id,
    name: `Participant ${id}`,
    email: `${id}@example.com`,
    role: 'Contributor',
    commissionKind: 'fixed_amount',
    commissionValue: 2500,
    status: 'Active',
    approvalStatus: 'Sent',
    inviteToken: 'token',
    workspaceSource: 'project',
    operationalStatus: 'active',
    payoutVerificationConfirmed: false,
    compensationProfile: {
      compensationType: 'FIXED_FEE',
      fixedAmount: 2500,
      configured: true,
      revenueSources: [],
      customerAttributionEnabled: false,
      commissionSourceMode: 'all_active',
      commissionServiceIds: [],
    },
  } as DemoParticipant;
}

function mockHandlers(overrides?: Partial<OperationalSyncHandlers>): OperationalSyncHandlers {
  return {
    invalidate: jest.fn(),
    refreshWorkspace: jest.fn().mockResolvedValue(undefined),
    reloadCoordinationSnapshot: jest.fn().mockResolvedValue(undefined),
    notifyActivation: jest.fn(),
    onAudit: jest.fn(),
    ...overrides,
  };
}

describe('operational convergence failure modes', () => {
  const prevNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    resetOperationalConvergenceQueueForTests();
    resetOperationalEventBusForTests();
    resetOperationalTelemetryForTests();
  });

  afterEach(() => {
    process.env.NODE_ENV = prevNodeEnv;
  });

  it('enforces canonical mutation → convergence phase ordering', async () => {
    const phases: string[] = [];
    const handlers = mockHandlers();
    await applyOperationalSyncConvergence(
      handlers,
      { invalidatedScopes: ['all'] },
      { mutation: 'participant_earnings_save', projectId: 'deal-1' },
      { onPhase: (phase) => phases.push(phase) }
    );

    const ordered = OPERATIONAL_CONVERGENCE_PHASE_ORDER.filter((p) => phases.includes(p));
    expect(ordered).toEqual(
      OPERATIONAL_CONVERGENCE_PHASE_ORDER.filter((p) =>
        [
          'server-commit-complete',
          'invalidate-caches',
          'refresh-trigger',
          'coordination-snapshot-response',
          'activation-sync',
          'ui-render-convergence',
          'mutation-success',
        ].includes(p)
      )
    );
    expect(phases.indexOf('mutation-success')).toBeGreaterThan(
      phases.indexOf('coordination-snapshot-response')
    );
  });

  it('flags slow refresh work as timed out before half-converged UI state', async () => {
    const outcome = await withConvergenceTimeout(
      () => new Promise<void>((resolve) => setTimeout(resolve, 80)),
      { timeoutMs: 25 }
    );
    expect(outcome.timedOut).toBe(true);
    if (outcome.timedOut) {
      expect(outcome.thresholdMs).toBe(25);
    }
  });

  it('continues convergence when activation refresh rejects (partial API failure)', async () => {
    const handlers = mockHandlers({
      refreshWorkspace: jest.fn().mockRejectedValue(new Error('activation 503')),
      reloadCoordinationSnapshot: jest.fn().mockResolvedValue(undefined),
    });

    await applyOperationalSyncConvergence(handlers, undefined, {
      mutation: 'agreement_approval',
      projectId: 'deal-1',
    });

    expect(handlers.invalidate).toHaveBeenCalled();
    expect(
      getRecentOperationalTelemetry().some((e) => e.type === 'convergence_recovery')
    ).toBe(true);
  });

  it('serializes rapid sequential mutations without losing final convergence', async () => {
    const handlers = mockHandlers();
    const order: number[] = [];
    let counter = 0;
    const slowRefresh = jest.fn().mockImplementation(async () => {
      const id = ++counter;
      order.push(id);
      order.push(id);
    });
    handlers.refreshWorkspace = slowRefresh;

    await Promise.all([
      applyOperationalSyncConvergence(handlers, undefined, {
        mutation: 'participant_earnings_save',
        projectId: 'deal-1',
      }),
      applyOperationalSyncConvergence(handlers, undefined, {
        mutation: 'payout_verification',
        projectId: 'deal-1',
      }),
      applyOperationalSyncConvergence(handlers, undefined, {
        mutation: 'funding_update',
        projectId: 'deal-1',
      }),
    ]);

    expect(order.length).toBe(6);
    expect(order[order.length - 1]).toBe(3);
  });

  it('deduplicates duplicate operational events within window', () => {
    const received: string[] = [];
    subscribeOperationalEvents((e) => received.push(e.type));
    const event = {
      type: 'PARTICIPANT_COMPENSATION_UPDATED' as const,
      participantId: 'p-1',
      projectId: 'deal-1',
      timestamp: '2026-05-20T12:00:00.000Z',
      source: 'client' as const,
    };
    dispatchOperationalEvent(event);
    dispatchOperationalEvent(event);
    expect(received).toHaveLength(1);
    expect(
      getRecentOperationalTelemetry().some(
        (e) => e.type === 'operational_event_ordering_anomaly' && e.anomaly === 'duplicate_suppressed'
      )
    ).toBe(true);
  });

  it('does not zero persisted counts when stale empty API arrives after mutation', () => {
    const participants = [readyParticipant('p-1')];
    expect(hasPersistedOperationalEntities(participants)).toBe(true);

    const emptyApi = emptyOperationalGraphProjection();
    const persisted = getOperationalCoordinationSnapshot({
      participants,
      projectId: 'deal-1',
      fundingAllocated: true,
    });

    const apiHasEntities =
      (emptyApi.summary?.participantCount ?? 0) > 0 || (emptyApi.participants?.length ?? 0) > 0;
    const effective = apiHasEntities ? emptyApi : persisted;

    expect(effective.summary.earningsConfiguredCount).toBeGreaterThan(0);
    expect(effective.summary.participantCount).toBe(1);
  });

  it('hydrates stale cache without dropping persisted participants from canonical snapshot', () => {
    const participants = [
      readyParticipant('p-1'),
      readyParticipant('p-2', { approvalStatus: 'Sent' }),
    ];
    const snapshot = buildPersistedCoordinationSnapshot({
      participants,
      projectId: 'deal-1',
      fundingAllocated: true,
    });
    expect(snapshot.summary.participantCount).toBe(2);
    expect(snapshot.participants.length).toBe(2);
  });

  it('detects payout-ready regression after persistence', () => {
    process.env.NODE_ENV = 'development';
    const participants = [readyParticipant('p-1')];
    const graph = getOperationalCoordinationSnapshot({
      participants,
      projectId: 'deal-1',
      fundingAllocated: true,
    });

    expect(() =>
      assertPostConvergenceIntegrity({
        mutation: 'payout_verification',
        participants,
        graphSummary: {
          participantCount: graph.summary.participantCount,
          earningsConfiguredCount: graph.summary.earningsConfiguredCount,
          payoutReadyCount: graph.summary.payoutReadyCount,
          obligationCount: 0,
        },
        canonicalKpis: null,
        minPayoutReadyCount: graph.summary.payoutReadyCount + 1,
      })
    ).toThrow(OperationalInvariantViolation);
  });

  it('withConvergenceTimeout resolves fast work before threshold', async () => {
    const outcome = await withConvergenceTimeout(async () => 'ok', { timeoutMs: 5000 });
    expect(outcome.timedOut).toBe(false);
    if (!outcome.timedOut) expect(outcome.result).toBe('ok');
  });
});
