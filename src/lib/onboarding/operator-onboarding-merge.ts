import type { OperatorOnboardingState } from '@/lib/onboarding/operator-onboarding-types';

export type OperatorOnboardingPatch = Partial<OperatorOnboardingState> & {
  pending_billing_plan?: OperatorOnboardingState['pending_billing_plan'] | null;
};

const MERGE_KEYS: readonly (keyof OperatorOnboardingState)[] = [
  'step',
  'workspace_name',
  'workspace_industry',
  'workspace_team_size',
  'onboarding_use_case',
  'onboarding_start_method',
  'onboarding_context',
  'collection_preference',
  'organizationId',
  'merchantSettingsId',
  'projectId',
  'completed',
  'completedAt',
  'pending_billing_plan',
];

function isDefinedPatchValue(value: unknown): boolean {
  return value !== undefined;
}

/**
 * Merge an incoming patch into the latest snapshot.
 * Omitted/undefined keys are kept. `pending_billing_plan: null` clears that field.
 */
export function mergeOperatorOnboardingState(
  current: OperatorOnboardingState | null,
  incoming: OperatorOnboardingPatch
): OperatorOnboardingState {
  const next: OperatorOnboardingState = {
    step: current?.step ?? incoming.step ?? 'workspace',
    ...(current ?? {}),
  };

  for (const key of MERGE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(incoming, key)) continue;
    const value = incoming[key];
    if (!isDefinedPatchValue(value)) continue;
    if (key === 'pending_billing_plan' && value === null) {
      delete next.pending_billing_plan;
      continue;
    }
    (next as Record<string, unknown>)[key] = value;
  }

  return next;
}

/**
 * Completed workspaces keep lifecycle identity even if a stale patch supplies
 * step/context/project fields. Other explicitly supplied in-progress fields
 * remain mergeable only when the snapshot is not completed.
 */
export function applyCompletedOnboardingGuard(
  current: OperatorOnboardingState | null,
  merged: OperatorOnboardingState
): OperatorOnboardingState {
  if (current?.completed !== true) return merged;

  return {
    ...merged,
    completed: true,
    completedAt: current.completedAt,
    step: current.step,
    projectId: current.projectId,
    onboarding_context: current.onboarding_context,
  };
}

export function resolveOperatorOnboardingPatch(
  current: OperatorOnboardingState | null,
  incoming: OperatorOnboardingPatch
): OperatorOnboardingState {
  return applyCompletedOnboardingGuard(current, mergeOperatorOnboardingState(current, incoming));
}
