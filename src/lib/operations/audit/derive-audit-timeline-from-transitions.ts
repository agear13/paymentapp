import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import type { OperationalTransitionRecord } from '@/lib/operations/onboarding/operational-transition-types';
import { mergeAuditTimeline } from '@/lib/operations/audit/operational-audit';

const TRANSITION_AUDIT_MAP: Partial<
  Record<
    OperationalTransitionRecord['phase'],
    { type: OperationalAuditEntry['type']; title: string; describe: (t: OperationalTransitionRecord) => string }
  >
> = {
  WORKSPACE_CREATED: {
    type: 'workspace_created',
    title: 'Workspace created',
    describe: () => 'Operational workspace and merchant settings bootstrapped.',
  },
  PROJECT_BOOTSTRAPPED: {
    type: 'project_initialized',
    title: 'Project initialized',
    describe: (t) => `First project bootstrapped${t.projectId ? ` (${t.projectId})` : ''}.`,
  },
  PAYMENT_RAIL_INITIALIZED: {
    type: 'payment_rails_connected',
    title: 'Payment rails connected',
    describe: () => 'Collection and settlement payment rails initialized.',
  },
  STRIPE_CONNECT_COMPLETED: {
    type: 'stripe_connected',
    title: 'Stripe connected',
    describe: () => 'Stripe account linked for card collection.',
  },
  OPERATIONAL_GRAPH_READY: {
    type: 'operational_graph_initialized',
    title: 'Operational graph initialized',
    describe: () => 'Operational coordination graph converged and ready.',
  },
  SETTLEMENT_INFRASTRUCTURE_READY: {
    type: 'settlement_infrastructure_ready',
    title: 'Settlement infrastructure ready',
    describe: () => 'Settlement rails and coordination infrastructure ready.',
  },
  OPERATIONAL_GRAPH_INITIALIZATION_FAILED: {
    type: 'operational_graph_initialization_failed',
    title: 'Operational graph initialization failed',
    describe: (t) => {
      const blockers = t.metadata?.blockers;
      if (Array.isArray(blockers) && blockers.length) {
        return `Initialization failed: ${blockers.join('; ')}`;
      }
      return 'Operational graph initialization did not complete.';
    },
  },
};

/** Mount persisted onboarding transitions into the operational audit timeline. */
export function deriveAuditTimelineFromTransitions(
  transitions: OperationalTransitionRecord[]
): OperationalAuditEntry[] {
  const entries: OperationalAuditEntry[] = [];

  for (const t of transitions) {
    if (t.status === 'started') continue;
    const mapping = TRANSITION_AUDIT_MAP[t.phase];
    if (!mapping) continue;

    entries.push({
      id: `init-${t.phase}-${t.id}`,
      type: mapping.type,
      title: mapping.title,
      description: mapping.describe(t),
      timestamp: t.completedAt ?? t.failedAt ?? t.startedAt,
      projectId: t.projectId ?? undefined,
    });
  }

  return entries;
}

export function mergeInitializationAuditTimeline(
  base: OperationalAuditEntry[],
  transitions: OperationalTransitionRecord[]
): OperationalAuditEntry[] {
  return mergeAuditTimeline(base, deriveAuditTimelineFromTransitions(transitions));
}
