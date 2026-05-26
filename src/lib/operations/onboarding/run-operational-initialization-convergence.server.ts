import 'server-only';

import { getOperatorOnboardingState } from '@/lib/onboarding/operator-onboarding.server';
import {
  ensureProjectBootstrapComplete,
  ensureSettlementRailsInitialized,
  ensureWorkspaceExists,
  ensureOperationalGraphReady,
} from '@/lib/operations/onboarding/operational-onboarding-barriers.server';
import {
  countActiveInitializationChains,
  getLatestOperationalCorrelationId,
  hasCompletedTransition,
  listOperationalTransitions,
  persistOperationalTransition,
} from '@/lib/operations/onboarding/persist-operational-transition.server';
import type { OperationalOnboardingPhase } from '@/lib/operations/onboarding/operational-onboarding-phases';
import {
  createOperationalCorrelationId,
  pendingTransitionsAfter,
  type OperationalInitializationSnapshot,
  type OperationalTransitionType,
} from '@/lib/operations/onboarding/operational-transition-types';
import { validateOperationalGraphConvergence } from '@/lib/operations/onboarding/validate-operational-graph-convergence.server';
import {
  buildOperationalOnboardingState,
  type ConvergenceRunResult,
} from '@/lib/operations/onboarding/build-operational-onboarding-state.server';
import { assertConvergenceInvariants } from '@/lib/operations/dev/operational-invariants';

export type { ConvergenceRunResult };

async function resolveCorrelationId(input: {
  organizationId: string | null;
  correlationId?: string;
  resume?: boolean;
}): Promise<string> {
  if (input.correlationId) return input.correlationId;
  if (input.organizationId && input.resume) {
    const latest = await getLatestOperationalCorrelationId(input.organizationId);
    if (latest) return latest;
  }
  return createOperationalCorrelationId();
}

async function persistPhaseIfNew(input: {
  organizationId: string;
  projectId: string | null;
  phase: OperationalTransitionType;
  previousPhase: OperationalTransitionType | null;
  correlationId: string;
  triggerSource: string;
  userId: string;
  recordKind?: 'transition' | 'bootstrap_event' | 'graph_initialization' | 'settlement_rail_initialization';
  orchestrationEventId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const done = await hasCompletedTransition({
    organizationId: input.organizationId,
    phase: input.phase,
    correlationId: input.correlationId,
  });
  if (done) return;

  await persistOperationalTransition({
    organizationId: input.organizationId,
    projectId: input.projectId,
    recordKind: input.recordKind,
    phase: input.phase,
    previousPhase: input.previousPhase,
    status: 'completed',
    correlationId: input.correlationId,
    triggerSource: input.triggerSource,
    userId: input.userId,
    orchestrationEventId: input.orchestrationEventId,
    metadata: input.metadata,
  });
}

function lastCompletedPhase(
  transitions: Awaited<ReturnType<typeof listOperationalTransitions>>
): OperationalTransitionType | null {
  const completed = transitions.filter((t) => t.status === 'completed');
  return completed.length ? completed[completed.length - 1]!.phase : null;
}

/**
 * Universal operational initialization convergence — all bootstrap/onboarding entrypoints
 * MUST route through this function.
 */
export async function runOperationalInitializationConvergence(input: {
  userId: string;
  organizationId?: string | null;
  projectId?: string | null;
  correlationId?: string;
  triggerSource: string;
  orchestrate?: boolean;
  resume?: boolean;
}): Promise<ConvergenceRunResult> {
  const onboarding = input.organizationId
    ? await getOperatorOnboardingState(input.organizationId)
    : null;

  const orgId = input.organizationId ?? onboarding?.organizationId ?? null;
  const correlationId = await resolveCorrelationId({
    organizationId: orgId,
    correlationId: input.correlationId,
    resume: input.resume,
  });

  if (orgId && process.env.NODE_ENV === 'development') {
    const activeChains = await countActiveInitializationChains(orgId);
    assertConvergenceInvariants({ multipleActiveInitializationChains: activeChains > 1 });
  }

  const workspace = await ensureWorkspaceExists(input.userId, orgId);
  const project = await ensureProjectBootstrapComplete(
    input.userId,
    input.projectId ?? onboarding?.projectId ?? null
  );
  const rails = await ensureSettlementRailsInitialized(workspace.organizationId);

  let previousPhase: OperationalTransitionType | null = null;

  if (orgId) {
    if (workspace.ready) {
      await persistPhaseIfNew({
        organizationId: orgId,
        projectId: project.projectId,
        phase: 'WORKSPACE_CREATED',
        previousPhase,
        correlationId,
        triggerSource: input.triggerSource,
        userId: input.userId,
        recordKind: 'bootstrap_event',
      });
      previousPhase = 'WORKSPACE_CREATED';
    }

    if (project.ready) {
      await persistPhaseIfNew({
        organizationId: orgId,
        projectId: project.projectId,
        phase: 'PROJECT_BOOTSTRAPPED',
        previousPhase,
        correlationId,
        triggerSource: input.triggerSource,
        userId: input.userId,
        recordKind: 'bootstrap_event',
      });
      previousPhase = 'PROJECT_BOOTSTRAPPED';
    }

    if (rails.ready) {
      await persistPhaseIfNew({
        organizationId: orgId,
        projectId: project.projectId,
        phase: 'PAYMENT_RAIL_INITIALIZED',
        previousPhase,
        correlationId,
        triggerSource: input.triggerSource,
        userId: input.userId,
        recordKind: 'settlement_rail_initialization',
      });
      previousPhase = 'PAYMENT_RAIL_INITIALIZED';
    }

    if (rails.stripeConnected) {
      await persistPhaseIfNew({
        organizationId: orgId,
        projectId: project.projectId,
        phase: 'STRIPE_CONNECT_COMPLETED',
        previousPhase,
        correlationId,
        triggerSource: input.triggerSource,
        userId: input.userId,
        recordKind: 'settlement_rail_initialization',
      });
      previousPhase = 'STRIPE_CONNECT_COMPLETED';
    }
  }

  let graphReady = false;
  let orchestrationHealthy = true;
  const blockers: string[] = [];

  if (!workspace.ready) blockers.push('Workspace not created');
  if (!project.ready) blockers.push('Project not bootstrapped');
  if (!rails.ready) blockers.push('Payment rails not initialized');

  const canOrchestrate =
    workspace.ready && project.ready && rails.ready && project.projectId && orgId;

  if (canOrchestrate && input.orchestrate) {
    await persistOperationalTransition({
      organizationId: orgId,
      projectId: project.projectId,
      recordKind: 'graph_initialization',
      phase: 'OPERATIONAL_GRAPH_INITIALIZATION_STARTED',
      previousPhase,
      status: 'started',
      correlationId,
      triggerSource: input.triggerSource,
      userId: input.userId,
    });

    const orchestrated = await ensureOperationalGraphReady({
      userId: input.userId,
      projectId: project.projectId,
      organizationId: orgId,
      correlationId,
    });

    graphReady = orchestrated.ready;
    if (!orchestrated.ready) {
      orchestrationHealthy = false;
      blockers.push(...orchestrated.blockers);
      await persistOperationalTransition({
        organizationId: orgId,
        projectId: project.projectId,
        recordKind: 'graph_initialization',
        phase: 'OPERATIONAL_GRAPH_INITIALIZATION_FAILED',
        previousPhase: 'OPERATIONAL_GRAPH_INITIALIZATION_STARTED',
        status: 'failed',
        correlationId,
        triggerSource: input.triggerSource,
        userId: input.userId,
        metadata: { blockers: orchestrated.blockers },
      });
    } else {
      await persistPhaseIfNew({
        organizationId: orgId,
        projectId: project.projectId,
        phase: 'OPERATIONAL_GRAPH_READY',
        previousPhase: 'OPERATIONAL_GRAPH_INITIALIZATION_STARTED',
        correlationId,
        triggerSource: input.triggerSource,
        userId: input.userId,
        recordKind: 'graph_initialization',
      });
      await persistPhaseIfNew({
        organizationId: orgId,
        projectId: project.projectId,
        phase: 'SETTLEMENT_INFRASTRUCTURE_READY',
        previousPhase: 'OPERATIONAL_GRAPH_READY',
        correlationId,
        triggerSource: input.triggerSource,
        userId: input.userId,
        recordKind: 'settlement_rail_initialization',
      });
    }
  } else if (canOrchestrate) {
    const { probeGraphReady } = await import(
      '@/lib/operations/onboarding/probe-operational-graph.server'
    );
    graphReady = await probeGraphReady({
      userId: input.userId,
      projectId: project.projectId!,
    });
    if (!graphReady && rails.stripeConnected) {
      blockers.push('Operational graph not yet ready');
    }
  }

  const settlementReady = graphReady && rails.ready;
  let convergence = {
    converged: false,
    blockers: [] as string[],
    checks: {} as Record<string, boolean>,
  };

  if (graphReady && orgId && project.projectId) {
    convergence = await validateOperationalGraphConvergence({
      userId: input.userId,
      organizationId: orgId,
      projectId: project.projectId,
      graphReady,
      settlementReady,
    });
    if (!convergence.converged) {
      blockers.push(...convergence.blockers);
      orchestrationHealthy = false;
    }
  }

  const snapshot = await resolveOperationalInitializationSnapshot({
    userId: input.userId,
    organizationId: orgId,
    correlationId,
    runtime: { workspace, project, rails, graphReady, blockers },
  });

  const onboardingState = buildOperationalOnboardingState({
    workspace,
    project,
    rails,
    graphReady,
    blockers: [...new Set(blockers)],
    organizationId: orgId,
    merchantSettingsId: workspace.merchantSettingsId ?? onboarding?.merchantSettingsId ?? null,
    correlationId,
  });

  return {
    correlationId,
    snapshot,
    onboarding: onboardingState,
    convergence,
    orchestrationHealthy,
  };
}

/** Canonical initialization selector — persisted transitions + runtime barriers. */
export async function resolveOperationalInitializationSnapshot(input: {
  userId: string;
  organizationId?: string | null;
  correlationId?: string;
  runtime?: {
    workspace: Awaited<ReturnType<typeof ensureWorkspaceExists>>;
    project: Awaited<ReturnType<typeof ensureProjectBootstrapComplete>>;
    rails: Awaited<ReturnType<typeof ensureSettlementRailsInitialized>>;
    graphReady: boolean;
    blockers: string[];
  };
}): Promise<OperationalInitializationSnapshot> {
  const orgId = input.organizationId ?? null;
  const correlationId =
    input.correlationId ??
    (orgId ? (await getLatestOperationalCorrelationId(orgId)) ?? createOperationalCorrelationId() : createOperationalCorrelationId());

  const transitions = orgId
    ? await listOperationalTransitions({ organizationId: orgId, correlationId })
    : [];

  const completedPhases = transitions
    .filter((t) => t.status === 'completed')
    .map((t) => t.phase);

  const failed = transitions.find((t) => t.status === 'failed');
  const lastSuccessful = [...transitions].reverse().find((t) => t.status === 'completed') ?? null;

  const workspace =
    input.runtime?.workspace ??
    (await ensureWorkspaceExists(input.userId, orgId));
  const project =
    input.runtime?.project ??
    (await ensureProjectBootstrapComplete(input.userId, null));
  const rails =
    input.runtime?.rails ??
    (await ensureSettlementRailsInitialized(workspace.organizationId));

  const graphReady = input.runtime?.graphReady ?? false;
  const blockers = input.runtime?.blockers ?? [];
  const settlementReady = graphReady && rails.ready;

  const onboarding = buildOperationalOnboardingState({
    workspace,
    project,
    rails,
    graphReady,
    blockers,
    organizationId: workspace.organizationId,
    merchantSettingsId: workspace.merchantSettingsId,
    correlationId,
  });

  return {
    currentPhase: onboarding.phase,
    completedPhases,
    pendingPhases: pendingTransitionsAfter(completedPhases),
    failedPhase: failed?.phase ?? null,
    blockers: onboarding.blockers,
    retryable: Boolean(failed) || (rails.stripeConnected && !graphReady),
    graphReady,
    settlementReady,
    orchestrationHealthy: !failed && graphReady,
    lastSuccessfulTransition: lastSuccessful,
    correlationId,
    onboarding,
  };
}

/** Replay missing orchestration stages from persisted transition state. */
export async function resumeOperationalInitialization(input: {
  userId: string;
  organizationId: string;
  correlationId?: string;
  triggerSource: string;
}): Promise<ConvergenceRunResult> {
  const transitions = await listOperationalTransitions({
    organizationId: input.organizationId,
    correlationId: input.correlationId,
  });

  const failed = transitions.find((t) => t.status === 'failed');
  const lastCompleted = lastCompletedPhase(transitions);

  return runOperationalInitializationConvergence({
    userId: input.userId,
    organizationId: input.organizationId,
    correlationId: input.correlationId ?? failed?.correlationId ?? transitions[0]?.correlationId,
    triggerSource: input.triggerSource,
    orchestrate: true,
    resume: true,
    projectId: transitions.find((t) => t.projectId)?.projectId ?? undefined,
  });
}
