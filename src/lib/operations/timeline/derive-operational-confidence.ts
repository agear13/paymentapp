import type { ReleaseConfidenceLevel } from '@/lib/operations/explainability/types';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import type {
  CanonicalOperationalEvent,
  OperationalConfidenceScore,
  OperationalTimelineReducerState,
} from '@/lib/operations/timeline/types';

const CRITICAL_EVENT_TYPES = [
  'WORKSPACE_BOOTSTRAPPED',
  'STRIPE_CONNECT_COMPLETED',
  'OPERATIONAL_GRAPH_INITIALIZED',
  'PARTICIPANT_COMPENSATION_UPDATED',
  'AGREEMENT_APPROVED',
  'FUNDING_ALLOCATION_RESERVED',
] as const;

function scoreToLevel(score: number, blocked: boolean): ReleaseConfidenceLevel {
  if (blocked) return 'BLOCKED';
  if (score >= 80) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  return 'LOW';
}

/**
 * Operational confidence scoring — derived from event coverage and workspace convergence.
 */
export function deriveOperationalConfidenceFromEvents(input: {
  state: OperationalTimelineReducerState;
  events: CanonicalOperationalEvent[];
  workspace: WorkspaceOperationalContext;
  graphSnapshotConverged?: boolean;
}): OperationalConfidenceScore {
  const critical = CRITICAL_EVENT_TYPES.filter((type) => {
    if (type === 'PARTICIPANT_COMPENSATION_UPDATED' && input.workspace.participantCount === 0) {
      return false;
    }
    if (type === 'AGREEMENT_APPROVED' && input.workspace.participantCount === 0) {
      return false;
    }
    if (type === 'FUNDING_ALLOCATION_RESERVED' && input.workspace.obligationCount === 0) {
      return false;
    }
    return true;
  });

  const observed = critical.filter((type) => input.state.observedTypes.has(type)).length;
  const coveragePercent =
    critical.length === 0 ? 100 : Math.round((observed / critical.length) * 100);

  let score = coveragePercent;
  if (input.graphSnapshotConverged === false) {
    score = Math.min(score, 40);
  }
  if (input.workspace.releaseEligibleCount > 0) {
    score = Math.min(100, score + 15);
  }

  const blocked =
    !input.state.observedTypes.has('OPERATIONAL_GRAPH_INITIALIZED') &&
    input.graphSnapshotConverged !== true;

  const level = scoreToLevel(score, blocked);
  const missing = critical.filter((type) => !input.state.observedTypes.has(type));

  const bullets: string[] = [];
  if (missing.length > 0) {
    bullets.push(
      `${missing.length} critical coordination event${missing.length === 1 ? '' : 's'} not yet observed.`
    );
  }
  if (input.events.length > 0) {
    bullets.push(`${input.events.length} canonical events replayed in deterministic order.`);
  }
  if (input.workspace.releaseEligibleCount > 0) {
    bullets.push(
      `${input.workspace.releaseEligibleCount} participant${input.workspace.releaseEligibleCount === 1 ? '' : 's'} release-ready in graph.`
    );
  }

  return {
    level,
    score,
    coveragePercent,
    observedCriticalEvents: observed,
    totalCriticalEvents: critical.length,
    explainability: {
      headline:
        level === 'BLOCKED'
          ? 'Operational confidence blocked — coordination events incomplete'
          : level === 'HIGH'
            ? 'High operational confidence from event coverage'
            : 'Operational confidence building from coordination events',
      bullets,
    },
  };
}
