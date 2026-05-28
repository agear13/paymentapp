import type { OperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import {
  emptyOperationalGraphFunding,
  emptyOperationalGraphSummary,
  parseCoordinationSnapshotProjection,
  type CoordinationSnapshotProjectionPayload,
} from '@/lib/operations/selectors/operational-coordination-snapshot';
import { guidanceFromOperationalGraph } from '@/lib/operations/selectors/operational-graph-adapter';
import type { OperationalGuidanceBundle } from '@/lib/operations/explainability';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import type { OperationalOnboardingState } from '@/lib/operations/onboarding/operational-onboarding-phases';
import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import { validateProjectableOperationalSnapshot } from '@/lib/operations/dev/operational-architecture-guards';

export type SafeProjectionInput = {
  payload: CoordinationSnapshotProjectionPayload;
  workspace: WorkspaceOperationalContext;
  scope?: 'workspace' | 'project';
  scopeTitle?: string;
  auditTimeline?: OperationalAuditEntry[];
  operationalOnboarding?: OperationalOnboardingState | null;
  fallbackGuidance: () => OperationalGuidanceBundle;
};

export type SafeProjectionResult = {
  projection: Pick<
    OperationalCoordinationSnapshot,
    'summary' | 'funding' | 'participants' | 'obligations'
  > | null;
  guidance: OperationalGuidanceBundle;
  converged: boolean;
  degraded: boolean;
};

/**
 * Canonical safe projection boundary — parses snapshot and derives guidance without throwing.
 */
export function safeOperationalProjection(input: SafeProjectionInput): SafeProjectionResult {
  const projection = parseCoordinationSnapshotProjection(input.payload);
  const converged =
    projection != null &&
    (input.payload.graphReady === true ||
      (projection.summary?.participantCount ?? 0) > 0);

  if (!converged) {
    return {
      projection: null,
      guidance: input.fallbackGuidance(),
      converged: false,
      degraded: true,
    };
  }

  try {
    validateProjectableOperationalSnapshot({
      summaryPresent: projection.summary != null,
      fundingPresent: projection.funding != null,
    });
    const snapshot = projection as OperationalCoordinationSnapshot;
    const guidance = guidanceFromOperationalGraph({
      snapshot,
      workspace: input.workspace,
      scope: input.scope,
      scopeTitle: input.scopeTitle,
      auditTimeline: input.auditTimeline,
      graphReady: true,
      graphSnapshotConverged: true,
      operationalOnboarding: input.operationalOnboarding,
    });
    return {
      projection,
      guidance,
      converged: true,
      degraded: guidance.degraded,
    };
  } catch {
    return {
      projection,
      guidance: input.fallbackGuidance(),
      converged: true,
      degraded: true,
    };
  }
}

/** Empty graph shape for pre-convergence client state. */
export function emptyOperationalGraphProjection(): Pick<
  OperationalCoordinationSnapshot,
  'summary' | 'funding' | 'participants' | 'obligations'
> {
  return {
    summary: emptyOperationalGraphSummary(),
    funding: emptyOperationalGraphFunding(),
    participants: [],
    obligations: [],
  };
}
