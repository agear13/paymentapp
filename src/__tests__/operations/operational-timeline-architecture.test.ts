import { operationalEventFromMutation } from '@/lib/operations/contracts/operational-events';
import { defaultWorkspaceContext } from '@/lib/operations/types/operational-context';
import {
  collectOperationalEventStream,
  operationalTimelineReplayFingerprint,
  replayOperationalEvents,
  projectOperationalTimeline,
  safeEventProjection,
} from '@/lib/operations/timeline';
import {
  assertEventLayerInvariants,
  assertEventProjectionInvariants,
  assertEventReplayInvariants,
  OperationalInvariantViolation,
} from '@/lib/operations/dev/operational-invariants';

describe('event-driven operational timeline architecture', () => {
  const workspace = {
    ...defaultWorkspaceContext(),
    hasOrganization: true,
    stripeConfigured: true,
    participantCount: 2,
    participantsConfiguredCount: 1,
    obligationCount: 1,
  };

  it('replays events deterministically with stable fingerprint', () => {
    const events = [
      operationalEventFromMutation('agreement_approval', { projectId: 'p1', participantId: 'a1' }),
      operationalEventFromMutation('participant_earnings_save', { projectId: 'p1', participantId: 'a1' }),
      operationalEventFromMutation('agreement_approval', { projectId: 'p1', participantId: 'a1' }),
    ];

    const first = replayOperationalEvents(events);
    const second = replayOperationalEvents([...events].reverse());

    expect(first.map((e) => e.dedupeKey)).toEqual(second.map((e) => e.dedupeKey));
    expect(operationalTimelineReplayFingerprint(first)).toBe(
      operationalTimelineReplayFingerprint(second)
    );
  });

  it('projects onboarding milestones from initialization events', () => {
    const projection = projectOperationalTimeline({
      events: [
        {
          type: 'WORKSPACE_BOOTSTRAPPED',
          timestamp: '2026-05-01T10:00:00.000Z',
          source: 'server',
        },
        {
          type: 'STRIPE_CONNECT_COMPLETED',
          timestamp: '2026-05-01T10:05:00.000Z',
          source: 'server',
        },
      ],
      workspace,
      graphSnapshotConverged: false,
    });

    expect(projection.milestones.find((m) => m.eventType === 'WORKSPACE_BOOTSTRAPPED')?.complete).toBe(
      true
    );
    expect(projection.milestones.find((m) => m.eventType === 'STRIPE_CONNECT_COMPLETED')?.complete).toBe(
      true
    );
    expect(projection.milestones.find((m) => m.eventType === 'OPERATIONAL_GRAPH_INITIALIZED')?.complete).toBe(
      false
    );
  });

  it('scores operational confidence from critical event coverage', () => {
    const projection = projectOperationalTimeline({
      events: [
        { type: 'WORKSPACE_BOOTSTRAPPED', timestamp: '2026-05-01T10:00:00.000Z', source: 'server' },
        { type: 'STRIPE_CONNECT_COMPLETED', timestamp: '2026-05-01T10:05:00.000Z', source: 'server' },
        {
          type: 'PARTICIPANT_COMPENSATION_UPDATED',
          timestamp: '2026-05-01T10:10:00.000Z',
          source: 'server',
        },
      ],
      workspace,
      graphSnapshotConverged: true,
    });

    expect(projection.confidence.observedCriticalEvents).toBeGreaterThan(0);
    expect(projection.confidence.coveragePercent).toBeGreaterThan(0);
    expect(projection.confidence.score).toBeGreaterThan(0);
  });

  it('derives blockers from missing coordination events', () => {
    const projection = projectOperationalTimeline({
      events: [
        { type: 'WORKSPACE_BOOTSTRAPPED', timestamp: '2026-05-01T10:00:00.000Z', source: 'server' },
      ],
      workspace,
      graphSnapshotConverged: false,
    });

    expect(projection.blockers.some((b) => b.category === 'operational_graph_initializing')).toBe(
      true
    );
    expect(projection.blockers.some((b) => b.category === 'compensation_configuration_missing')).toBe(
      true
    );
  });

  it('merges audit timeline into event stream for projection', () => {
    const stream = collectOperationalEventStream({
      auditTimeline: [
        {
          id: 'audit-1',
          type: 'stripe_connected',
          title: 'Stripe connected',
          description: 'Stripe account linked.',
          timestamp: '2026-05-01T10:00:00.000Z',
        },
      ],
    });

    expect(stream.some((e) => e.type === 'STRIPE_CONNECT_COMPLETED')).toBe(true);
  });

  it('safe projection degrades without throwing on empty input', () => {
    const projection = safeEventProjection({ workspace });
    expect(projection.degraded).toBe(true);
    expect(projection.timeline.length).toBeGreaterThan(0);
  });

  it('throws event layer invariants in development when UI bypasses projection', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertEventLayerInvariants({ uiDerivesTimelineDirectly: true })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });

  it('throws when replay sequences are non-monotonic in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertEventReplayInvariants({ sequencesMonotonic: false })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });

  it('throws when timeline derived outside event layer in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertEventProjectionInvariants({ timelineDerivedOutsideEventLayer: true })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });
});
