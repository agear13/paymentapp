import type { TimelineEvent, TimelineEventType } from '@/lib/operations/explainability/types';
import type { CanonicalOperationalEvent } from '@/lib/operations/timeline/types';
import type { OnboardingMilestoneProjection } from '@/lib/operations/timeline/types';

const EVENT_TIMELINE_TYPE: Partial<Record<CanonicalOperationalEvent['type'], TimelineEventType>> = {
  WORKSPACE_BOOTSTRAPPED: 'workspace_created',
  PROJECT_BOOTSTRAPPED: 'state_transition',
  STRIPE_CONNECT_COMPLETED: 'provider_connected',
  PAYMENT_RAIL_INITIALIZED: 'provider_connected',
  PARTICIPANT_COMPENSATION_UPDATED: 'compensation_configured',
  AGREEMENT_APPROVED: 'obligation_approved',
  FUNDING_SOURCE_UPDATED: 'revenue_collected',
  FUNDING_ALLOCATION_RESERVED: 'revenue_collected',
  OBLIGATION_STATE_UPDATED: 'obligation_approved',
  RELEASE_BATCH_GENERATED: 'release_generated',
  PAYOUT_STATE_UPDATED: 'settlement_completed',
  OPERATIONAL_GRAPH_INITIALIZED: 'state_transition',
  SETTLEMENT_INFRASTRUCTURE_READY: 'state_transition',
};

const EVENT_TITLES: Partial<Record<CanonicalOperationalEvent['type'], string>> = {
  WORKSPACE_BOOTSTRAPPED: 'Workspace initialized',
  PROJECT_BOOTSTRAPPED: 'Project bootstrapped',
  STRIPE_CONNECT_COMPLETED: 'Stripe connected',
  PAYMENT_RAIL_INITIALIZED: 'Payment rails initialized',
  OPERATIONAL_GRAPH_INITIALIZED: 'Operational graph converged',
  SETTLEMENT_INFRASTRUCTURE_READY: 'Settlement infrastructure ready',
  PARTICIPANT_COMPENSATION_UPDATED: 'Participant earnings updated',
  AGREEMENT_APPROVED: 'Agreement approved',
  FUNDING_ALLOCATION_RESERVED: 'Funding reserved',
  OBLIGATION_STATE_UPDATED: 'Obligations updated',
  RELEASE_BATCH_GENERATED: 'Release batch generated',
  PAYOUT_STATE_UPDATED: 'Payout state updated',
};

function milestoneToTimelineEvent(milestone: OnboardingMilestoneProjection): TimelineEvent {
  return {
    id: `milestone-${milestone.id}`,
    type: EVENT_TIMELINE_TYPE[milestone.eventType] ?? 'state_transition',
    title: milestone.label,
    description: milestone.releaseImpact ?? 'Operational milestone.',
    timestamp: milestone.timestamp,
    completed: milestone.complete,
  };
}

function eventToTimelineEvent(event: CanonicalOperationalEvent): TimelineEvent {
  return {
    id: event.dedupeKey,
    type: EVENT_TIMELINE_TYPE[event.type] ?? 'state_transition',
    title: EVENT_TITLES[event.type] ?? event.type.replace(/_/g, ' ').toLowerCase(),
    description:
      (event.payload?.note as string | undefined) ??
      `Coordination event recorded from ${event.source}.`,
    timestamp: event.timestamp,
    completed: true,
  };
}

/** Convert event projection into UI timeline events — milestones first, then chronological events. */
export function deriveTimelineEventsFromProjection(input: {
  milestones: OnboardingMilestoneProjection[];
  events: CanonicalOperationalEvent[];
}): TimelineEvent[] {
  const milestoneEvents = input.milestones.map(milestoneToTimelineEvent);

  const eventEntries = input.events.map(eventToTimelineEvent);

  const byId = new Map<string, TimelineEvent>();
  for (const e of [...milestoneEvents, ...eventEntries]) {
    byId.set(e.id, e);
  }

  return [...byId.values()].sort((a, b) => {
    const ta = a.timestamp ? Date.parse(a.timestamp) : 0;
    const tb = b.timestamp ? Date.parse(b.timestamp) : 0;
    return ta - tb;
  });
}
