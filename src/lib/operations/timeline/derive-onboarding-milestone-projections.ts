import type { OperationalEventType } from '@/lib/operations/contracts/operational-events';
import { OPERATIONAL_INITIALIZATION_EVENT_TYPES } from '@/lib/operations/onboarding/operational-initialization-events';
import type {
  CanonicalOperationalEvent,
  OnboardingMilestoneProjection,
  OperationalTimelineReducerState,
} from '@/lib/operations/timeline/types';

const MILESTONE_META: Record<
  string,
  { label: string; releaseImpact?: string }
> = {
  WORKSPACE_BOOTSTRAPPED: {
    label: 'Workspace initialized',
    releaseImpact: 'Required before any payout coordination.',
  },
  PROJECT_BOOTSTRAPPED: {
    label: 'Project bootstrapped',
    releaseImpact: 'Participants and obligations attach to a project workspace.',
  },
  PAYMENT_RAIL_INITIALIZED: {
    label: 'Payment rails initialized',
    releaseImpact: 'Revenue collection must be active before funding obligations.',
  },
  STRIPE_CONNECT_COMPLETED: {
    label: 'Stripe connected',
    releaseImpact: 'Card collection enabled for customer payments.',
  },
  OPERATIONAL_GRAPH_INITIALIZED: {
    label: 'Operational graph converged',
    releaseImpact: 'Release review unlocks once projections synchronize.',
  },
  SETTLEMENT_INFRASTRUCTURE_READY: {
    label: 'Settlement infrastructure ready',
    releaseImpact: 'Payout release coordination becomes available.',
  },
  PARTICIPANT_COMPENSATION_UPDATED: {
    label: 'Participant earnings configured',
    releaseImpact: 'Obligations derive from compensation configuration.',
  },
  AGREEMENT_APPROVED: {
    label: 'Participation agreement approved',
    releaseImpact: 'Required before payout obligations can release.',
  },
  FUNDING_ALLOCATION_RESERVED: {
    label: 'Funding reserved against obligations',
    releaseImpact: 'Obligations must be funded before release.',
  },
  RELEASE_BATCH_GENERATED: {
    label: 'Payout release batch created',
    releaseImpact: 'Release batches move obligations toward settlement.',
  },
};

const MILESTONE_ORDER: OperationalEventType[] = [
  ...OPERATIONAL_INITIALIZATION_EVENT_TYPES,
  'PARTICIPANT_COMPENSATION_UPDATED',
  'AGREEMENT_APPROVED',
  'FUNDING_ALLOCATION_RESERVED',
  'OBLIGATION_STATE_UPDATED',
  'RELEASE_BATCH_GENERATED',
];

export function createTimelineReducerState(): OperationalTimelineReducerState {
  return {
    observedTypes: new Set(),
    milestoneTimestamps: new Map(),
    lastEventAt: null,
  };
}

export function reduceOperationalTimelineEvent(
  state: OperationalTimelineReducerState,
  event: CanonicalOperationalEvent
): OperationalTimelineReducerState {
  state.observedTypes.add(event.type);
  state.milestoneTimestamps.set(event.type, event.timestamp);
  state.lastEventAt = event.timestamp;
  return state;
}

export function reduceOperationalTimelineEvents(
  events: CanonicalOperationalEvent[]
): OperationalTimelineReducerState {
  const state = createTimelineReducerState();
  for (const event of events) {
    reduceOperationalTimelineEvent(state, event);
  }
  return state;
}

/** Onboarding milestone projections derived only from canonical event replay state. */
export function deriveOnboardingMilestoneProjections(
  state: OperationalTimelineReducerState
): OnboardingMilestoneProjection[] {
  return MILESTONE_ORDER.filter((type) => MILESTONE_META[type]).map((eventType) => {
    const meta = MILESTONE_META[eventType]!;
    const timestamp = state.milestoneTimestamps.get(eventType) ?? null;
    return {
      id: eventType.toLowerCase(),
      label: meta.label,
      eventType,
      complete: state.observedTypes.has(eventType),
      timestamp,
      releaseImpact: meta.releaseImpact,
    };
  });
}
