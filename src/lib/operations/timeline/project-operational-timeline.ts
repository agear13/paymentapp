import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import type { OperationalEvent } from '@/lib/operations/contracts/operational-events';
import type { OperationalTransitionRecord } from '@/lib/operations/onboarding/operational-transition-types';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import {
  collectOperationalEventStream,
  operationalTimelineReplayFingerprint,
} from '@/lib/operations/timeline/canonical-operational-event';
import { deriveBlockersFromEvents } from '@/lib/operations/timeline/derive-blockers-from-events';
import { deriveOperationalConfidenceFromEvents } from '@/lib/operations/timeline/derive-operational-confidence';
import {
  deriveOnboardingMilestoneProjections,
  reduceOperationalTimelineEvents,
} from '@/lib/operations/timeline/derive-onboarding-milestone-projections';
import { deriveTimelineEventsFromProjection } from '@/lib/operations/timeline/derive-timeline-events';
import { replayOperationalEvents } from '@/lib/operations/timeline/replay-operational-events';
import type { OperationalTimelineProjection } from '@/lib/operations/timeline/types';
import { assertEventProjectionInvariants } from '@/lib/operations/dev/operational-invariants';

export type ProjectOperationalTimelineInput = {
  events?: OperationalEvent[];
  auditTimeline?: OperationalAuditEntry[];
  transitions?: OperationalTransitionRecord[];
  workspace: WorkspaceOperationalContext;
  graphSnapshotConverged?: boolean;
};

/**
 * Canonical event projection — deterministic replay-safe operational timeline derivation.
 */
export function projectOperationalTimeline(
  input: ProjectOperationalTimelineInput
): OperationalTimelineProjection {
  const rawStream = collectOperationalEventStream({
    events: input.events,
    auditTimeline: input.auditTimeline,
    transitions: input.transitions,
  });

  const canonicalEvents = replayOperationalEvents(rawStream);
  const reducerState = reduceOperationalTimelineEvents(canonicalEvents);
  const milestones = deriveOnboardingMilestoneProjections(reducerState);
  const confidence = deriveOperationalConfidenceFromEvents({
    state: reducerState,
    events: canonicalEvents,
    workspace: input.workspace,
    graphSnapshotConverged: input.graphSnapshotConverged,
  });
  const blockers = deriveBlockersFromEvents({
    state: reducerState,
    workspace: input.workspace,
    graphSnapshotConverged: input.graphSnapshotConverged,
  });
  const timeline = deriveTimelineEventsFromProjection({ milestones, events: canonicalEvents });
  const replayFingerprint = operationalTimelineReplayFingerprint(canonicalEvents);

  if (process.env.NODE_ENV === 'development') {
    assertEventProjectionInvariants({
      timelineDerivedOutsideEventLayer: false,
      replayFingerprintEmpty: canonicalEvents.length > 0 && replayFingerprint.length === 0,
      nonDeterministicReplay: false,
    });
  }

  return {
    canonicalEvents,
    milestones,
    timeline,
    confidence,
    blockers,
    replayFingerprint,
    degraded: canonicalEvents.length === 0,
  };
}
