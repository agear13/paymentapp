import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import type { OperationalEvent, OperationalEventType } from '@/lib/operations/contracts/operational-events';
import type { OperationalTransitionRecord } from '@/lib/operations/onboarding/operational-transition-types';
import type { CanonicalOperationalEvent } from '@/lib/operations/timeline/types';

const AUDIT_TO_EVENT: Partial<Record<OperationalAuditEntry['type'], OperationalEventType>> = {
  workspace_created: 'WORKSPACE_BOOTSTRAPPED',
  project_initialized: 'PROJECT_BOOTSTRAPPED',
  payment_rails_connected: 'PAYMENT_RAIL_INITIALIZED',
  stripe_connected: 'STRIPE_CONNECT_COMPLETED',
  operational_graph_initialized: 'OPERATIONAL_GRAPH_INITIALIZED',
  settlement_infrastructure_ready: 'SETTLEMENT_INFRASTRUCTURE_READY',
  agreement_approved: 'AGREEMENT_APPROVED',
  agreement_shared: 'AGREEMENT_SHARED',
  agreement_viewed: 'AGREEMENT_VIEWED',
  compensation_updated: 'PARTICIPANT_COMPENSATION_UPDATED',
  attribution_configured: 'ATTRIBUTION_CONFIGURATION_UPDATED',
  funding_linked: 'FUNDING_SOURCE_UPDATED',
  funding_reserved_against_obligations: 'FUNDING_ALLOCATION_RESERVED',
  obligations_generated: 'OBLIGATION_STATE_UPDATED',
  payout_state_updated: 'PAYOUT_STATE_UPDATED',
  supplier_onboarding_started: 'SUPPLIER_ONBOARDING_STARTED',
  release_batch_generated: 'RELEASE_BATCH_GENERATED',
};

const TRANSITION_TO_EVENT: Partial<
  Record<OperationalTransitionRecord['phase'], OperationalEventType>
> = {
  WORKSPACE_CREATED: 'WORKSPACE_BOOTSTRAPPED',
  PROJECT_BOOTSTRAPPED: 'PROJECT_BOOTSTRAPPED',
  PAYMENT_RAIL_INITIALIZED: 'PAYMENT_RAIL_INITIALIZED',
  STRIPE_CONNECT_COMPLETED: 'STRIPE_CONNECT_COMPLETED',
  OPERATIONAL_GRAPH_READY: 'OPERATIONAL_GRAPH_INITIALIZED',
  SETTLEMENT_INFRASTRUCTURE_READY: 'SETTLEMENT_INFRASTRUCTURE_READY',
};

function stableTimestamp(value: string | null | undefined): string {
  if (value && !Number.isNaN(Date.parse(value))) return value;
  return '1970-01-01T00:00:00.000Z';
}

/** Deterministic dedupe key — replays collapse to one canonical event per logical mutation. */
export function operationalEventDedupeKey(event: OperationalEvent): string {
  const correlationId = event.payload?.correlationId as string | undefined;
  if (correlationId) {
    return `${event.type}:${correlationId}`;
  }
  return `${event.type}:${event.projectId ?? 'workspace'}:${event.participantId ?? 'none'}`;
}

export function toCanonicalOperationalEvent(
  event: OperationalEvent,
  sequence: number
): CanonicalOperationalEvent {
  return {
    ...event,
    sequence,
    dedupeKey: operationalEventDedupeKey(event),
    correlationId: event.payload?.correlationId as string | undefined,
  };
}

export function operationalEventFromAuditEntry(entry: OperationalAuditEntry): OperationalEvent | null {
  const type = AUDIT_TO_EVENT[entry.type];
  if (!type) return null;
  return {
    type,
    projectId: entry.projectId,
    participantId: entry.participantId,
    timestamp: entry.timestamp,
    source: 'server',
    payload: {
      auditId: entry.id,
      actor: entry.actor,
      note: entry.description,
    },
  };
}

export function operationalEventsFromTransitions(
  transitions: OperationalTransitionRecord[]
): OperationalEvent[] {
  const events: OperationalEvent[] = [];
  for (const t of transitions) {
    if (t.status === 'started') continue;
    const type = TRANSITION_TO_EVENT[t.phase];
    if (!type) continue;
    events.push({
      type,
      projectId: t.projectId ?? undefined,
      timestamp: stableTimestamp(t.completedAt ?? t.failedAt ?? t.startedAt),
      source: 'server',
      payload: {
        correlationId: t.correlationId,
        transitionId: t.id,
        blockers: t.metadata?.blockers,
      },
    });
  }
  return events;
}

/** Merge heterogeneous sources into a single operational event stream. */
export function collectOperationalEventStream(input: {
  events?: OperationalEvent[];
  auditTimeline?: OperationalAuditEntry[];
  transitions?: OperationalTransitionRecord[];
}): OperationalEvent[] {
  const merged: OperationalEvent[] = [...(input.events ?? [])];

  for (const entry of input.auditTimeline ?? []) {
    const event = operationalEventFromAuditEntry(entry);
    if (event) merged.push(event);
  }

  merged.push(...operationalEventsFromTransitions(input.transitions ?? []));

  return merged;
}

/** Deterministic replay fingerprint for regression and invariant checks. */
export function operationalTimelineReplayFingerprint(
  events: CanonicalOperationalEvent[]
): string {
  return events.map((e) => `${e.sequence}:${e.dedupeKey}`).join('|');
}
