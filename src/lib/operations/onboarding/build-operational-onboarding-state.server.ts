import 'server-only';

import { getPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';
import { resolveOperationalCoordinationSnapshot } from '@/lib/operations/selectors/resolve-operational-coordination.server';
import type {
  OperationalOnboardingPhase,
  OperationalOnboardingState,
} from '@/lib/operations/onboarding/operational-onboarding-phases';
import type { OperationalInitializationSnapshot } from '@/lib/operations/onboarding/operational-transition-types';
import type { OnboardingBarrierResult } from '@/lib/operations/onboarding/operational-onboarding-barriers.server';

export type ConvergenceRunResult = {
  correlationId: string;
  snapshot: OperationalInitializationSnapshot;
  onboarding: OperationalOnboardingState;
  convergence: {
    converged: boolean;
    blockers: string[];
    checks: Record<string, boolean>;
  };
  orchestrationHealthy: boolean;
};

function derivePhase(input: {
  workspaceReady: boolean;
  projectReady: boolean;
  paymentRailsReady: boolean;
  stripeConnected: boolean;
  graphReady: boolean;
}): OperationalOnboardingPhase {
  if (input.graphReady) return 'OPERATIONAL_GRAPH_READY';
  if (input.stripeConnected) return 'STRIPE_CONNECTED';
  if (input.paymentRailsReady) return 'PAYMENT_RAIL_INITIALIZED';
  if (input.projectReady) return 'PROJECT_BOOTSTRAPPED';
  if (input.workspaceReady) return 'WORKSPACE_CREATED';
  return 'ONBOARDING_STARTED';
}

function recoveryMessage(result: {
  graphReady: boolean;
  stripeConnected: boolean;
  projectReady: boolean;
  blockers: string[];
}): string | null {
  if (result.graphReady) return null;
  if (result.stripeConnected && result.projectReady) {
    return (
      'Settlement infrastructure is still initializing. Your payment rails were connected successfully. ' +
      'Operational coordination is being prepared.'
    );
  }
  if (result.blockers.length > 0) return result.blockers[0] ?? null;
  return 'Complete workspace setup to enable settlement coordination.';
}

export function buildOperationalOnboardingState(input: {
  workspace: { ready: boolean; organizationId: string | null; merchantSettingsId: string | null };
  project: { ready: boolean; projectId: string | null };
  rails: { ready: boolean; stripeConnected: boolean };
  graphReady: boolean;
  blockers: string[];
  organizationId: string | null;
  merchantSettingsId: string | null;
  correlationId: string;
}): OperationalOnboardingState {
  const pending: string[] = [];
  if (!input.workspace.ready) pending.push('Create workspace');
  if (!input.project.ready) pending.push('Bootstrap first project');
  if (!input.rails.ready) pending.push('Connect payment provider');
  else if (!input.rails.stripeConnected) pending.push('Connect Stripe for card collection');
  if (!input.graphReady && input.rails.stripeConnected) {
    pending.push('Initialize operational coordination');
  }

  const phase = derivePhase({
    workspaceReady: input.workspace.ready,
    projectReady: input.project.ready,
    paymentRailsReady: input.rails.ready,
    stripeConnected: input.rails.stripeConnected,
    graphReady: input.graphReady,
  });

  const result: OnboardingBarrierResult = {
    workspaceReady: input.workspace.ready,
    projectReady: input.project.ready,
    paymentRailsReady: input.rails.ready,
    stripeConnected: input.rails.stripeConnected,
    graphReady: input.graphReady,
    phase,
    blockers: input.blockers,
    pendingInitializationSteps: [...new Set(pending)],
    primaryProjectId: input.project.projectId,
    organizationId: input.organizationId,
    merchantSettingsId: input.merchantSettingsId,
    correlationId: input.correlationId,
  };

  return {
    phase: result.phase,
    workspaceReady: result.workspaceReady,
    projectReady: result.projectReady,
    paymentRailsReady: result.paymentRailsReady,
    stripeConnected: result.stripeConnected,
    graphReady: result.graphReady,
    blockers: result.blockers,
    pendingInitializationSteps: result.pendingInitializationSteps,
    primaryProjectId: result.primaryProjectId,
    organizationId: result.organizationId,
    merchantSettingsId: result.merchantSettingsId,
    recoveryMessage: recoveryMessage(result),
    correlationId: result.correlationId,
  };
}

/** Read-only graph readiness probe — no orchestration side effects. */
export async function probeGraphReady(input: {
  userId: string;
  projectId: string;
}): Promise<boolean> {
  try {
    const snapshot = await getPilotSnapshotForUser(input.userId);
    await resolveOperationalCoordinationSnapshot({
      userId: input.userId,
      projectId: input.projectId,
      participants: snapshot.participants,
    });
    return true;
  } catch {
    return false;
  }
}
