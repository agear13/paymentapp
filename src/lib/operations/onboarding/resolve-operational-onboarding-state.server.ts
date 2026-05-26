import 'server-only';

import {
  resolveOperationalInitializationSnapshot,
  runOperationalInitializationConvergence,
  resumeOperationalInitialization,
} from '@/lib/operations/onboarding/run-operational-initialization-convergence.server';
import type { OperationalOnboardingState } from '@/lib/operations/onboarding/operational-onboarding-phases';

/** Canonical onboarding readiness selector — read-only unless orchestrate=true. */
export async function resolveOperationalOnboardingState(input: {
  userId: string;
  organizationId?: string | null;
  orchestrate?: boolean;
  correlationId?: string;
  triggerSource?: string;
}): Promise<OperationalOnboardingState> {
  if (input.orchestrate) {
    const result = await runOperationalInitializationConvergence({
      userId: input.userId,
      organizationId: input.organizationId,
      correlationId: input.correlationId,
      triggerSource: input.triggerSource ?? 'resolve-operational-onboarding-state',
      orchestrate: true,
    });
    return result.onboarding;
  }

  const snapshot = await resolveOperationalInitializationSnapshot({
    userId: input.userId,
    organizationId: input.organizationId,
  });
  return snapshot.onboarding;
}

export async function runPostRailConnectOrchestration(input: {
  userId: string;
  organizationId: string;
  correlationId?: string;
}): Promise<OperationalOnboardingState> {
  const result = await runOperationalInitializationConvergence({
    userId: input.userId,
    organizationId: input.organizationId,
    correlationId: input.correlationId,
    triggerSource: 'merchant-settings-rail-connect',
    orchestrate: true,
  });
  return result.onboarding;
}

export {
  runOperationalInitializationConvergence,
  resumeOperationalInitialization,
  resolveOperationalInitializationSnapshot,
};
