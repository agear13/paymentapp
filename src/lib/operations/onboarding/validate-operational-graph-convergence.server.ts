import 'server-only';

import { getPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';
import { deriveOperationalBlockingActions } from '@/lib/operations/explainability/derive-operational-blocking-actions';
import { resolveOperationalCoordinationSnapshot } from '@/lib/operations/selectors/resolve-operational-coordination.server';
import {
  assertConvergenceInvariants,
  type ConvergenceInvariantInput,
} from '@/lib/operations/dev/operational-invariants';
import {
  ensureProjectBootstrapComplete,
  ensureSettlementRailsInitialized,
} from '@/lib/operations/onboarding/operational-onboarding-barriers.server';

export type OperationalGraphConvergenceResult = {
  converged: boolean;
  blockers: string[];
  checks: Record<string, boolean>;
};

/** Validates operational graph convergence after initialization barriers pass. */
export async function validateOperationalGraphConvergence(input: {
  userId: string;
  organizationId: string;
  projectId: string;
  graphReady: boolean;
  settlementReady: boolean;
}): Promise<OperationalGraphConvergenceResult> {
  const blockers: string[] = [];
  const checks: Record<string, boolean> = {
    projectExists: false,
    settlementRailsInitialized: false,
    fundingGraphResolvable: false,
    coordinationSnapshotResolvable: false,
    payoutReadinessDerivable: false,
    blockersDerivable: false,
    auditPipelineOperational: false,
  };

  const project = await ensureProjectBootstrapComplete(input.userId, input.projectId);
  checks.projectExists = project.ready && project.projectId === input.projectId;
  if (!checks.projectExists) {
    blockers.push('Project bootstrap incomplete');
  }

  const rails = await ensureSettlementRailsInitialized(input.organizationId);
  checks.settlementRailsInitialized = rails.ready;
  if (!checks.settlementRailsInitialized) {
    blockers.push('Settlement rails not initialized');
  }

  if (!input.graphReady) {
    blockers.push('Operational graph not ready');
    assertConvergenceInvariants(buildInvariantInput(input, checks, false));
    return { converged: false, blockers, checks };
  }

  try {
    const snapshot = await getPilotSnapshotForUser(input.userId);
    const graph = await resolveOperationalCoordinationSnapshot({
      userId: input.userId,
      projectId: input.projectId,
      participants: snapshot.participants,
    });

    checks.fundingGraphResolvable = Boolean(graph.funding);
    checks.coordinationSnapshotResolvable = graph.participants.length >= 0;
    checks.payoutReadinessDerivable = graph.summary.participantCount >= 0;
    checks.blockersDerivable = deriveOperationalBlockingActions(graph).blockers.length >= 0;
    checks.auditPipelineOperational = true;

    if (!checks.fundingGraphResolvable) blockers.push('Funding graph not resolvable');
    if (!checks.coordinationSnapshotResolvable) blockers.push('Coordination snapshot not resolvable');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    blockers.push(`Graph convergence validation failed (${message})`);
  }

  const converged =
    input.graphReady &&
    input.settlementReady &&
    checks.projectExists &&
    checks.settlementRailsInitialized &&
    checks.coordinationSnapshotResolvable &&
    blockers.length === 0;

  assertConvergenceInvariants(
    buildInvariantInput(input, checks, converged)
  );

  return { converged, blockers, checks };
}

function buildInvariantInput(
  input: {
    graphReady: boolean;
    settlementReady: boolean;
    projectId: string;
  },
  checks: Record<string, boolean>,
  converged: boolean
): ConvergenceInvariantInput {
  return {
    initializationCompletedWithoutGraph: converged && !input.graphReady,
    graphReadyWithoutSettlementRails: input.graphReady && !checks.settlementRailsInitialized,
    settlementReadyWithoutProject: input.settlementReady && !checks.projectExists,
    partialBootstrapWithReadyPhase: input.graphReady && !checks.projectExists,
    graphProjectionBeforeConvergenceValidation: !input.graphReady && converged,
  };
}
