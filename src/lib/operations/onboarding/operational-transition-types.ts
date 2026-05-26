import type { OperationalOnboardingPhase } from '@/lib/operations/onboarding/operational-onboarding-phases';

/** Immutable transition event types persisted for onboarding orchestration. */
export const OPERATIONAL_TRANSITION_TYPES = [
  'ONBOARDING_STARTED',
  'WORKSPACE_CREATED',
  'PROJECT_BOOTSTRAPPED',
  'PAYMENT_RAIL_INITIALIZED',
  'STRIPE_CONNECT_COMPLETED',
  'OPERATIONAL_GRAPH_INITIALIZATION_STARTED',
  'OPERATIONAL_GRAPH_READY',
  'OPERATIONAL_GRAPH_INITIALIZATION_FAILED',
  'SETTLEMENT_INFRASTRUCTURE_READY',
] as const;

export type OperationalTransitionType = (typeof OPERATIONAL_TRANSITION_TYPES)[number];

export type OperationalTransitionStatus = 'started' | 'completed' | 'failed';

export type OperationalTransitionRecord = {
  id: string;
  organizationId: string | null;
  projectId: string | null;
  recordKind: string;
  phase: OperationalTransitionType;
  previousPhase: OperationalTransitionType | null;
  status: OperationalTransitionStatus;
  startedAt: string;
  completedAt: string | null;
  failedAt: string | null;
  correlationId: string;
  triggerSource: string;
  userId: string | null;
  metadata: Record<string, unknown> | null;
  orchestrationEventId: string | null;
};

export type OperationalInitializationSnapshot = {
  currentPhase: OperationalOnboardingPhase;
  completedPhases: OperationalTransitionType[];
  pendingPhases: OperationalTransitionType[];
  failedPhase: OperationalTransitionType | null;
  blockers: string[];
  retryable: boolean;
  graphReady: boolean;
  settlementReady: boolean;
  orchestrationHealthy: boolean;
  lastSuccessfulTransition: OperationalTransitionRecord | null;
  correlationId: string;
  /** Runtime onboarding state for UI compatibility */
  onboarding: import('@/lib/operations/onboarding/operational-onboarding-phases').OperationalOnboardingState;
};

export function createOperationalCorrelationId(prefix = 'onb'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function transitionRank(phase: OperationalTransitionType): number {
  return OPERATIONAL_TRANSITION_TYPES.indexOf(phase);
}

export function pendingTransitionsAfter(
  completed: OperationalTransitionType[]
): OperationalTransitionType[] {
  const completedSet = new Set(completed);
  return OPERATIONAL_TRANSITION_TYPES.filter(
    (t) =>
      !completedSet.has(t) &&
      t !== 'OPERATIONAL_GRAPH_INITIALIZATION_STARTED' &&
      t !== 'OPERATIONAL_GRAPH_INITIALIZATION_FAILED'
  );
}
