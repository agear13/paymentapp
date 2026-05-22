import { canTransitionCompensationState } from '@/lib/operations/transitions/compensation-transitions';
import { canTransitionParticipantState } from '@/lib/operations/transitions/participant-transitions';
import { canTransitionProjectState } from '@/lib/operations/transitions/project-transitions';
import { canTransitionWorkspaceState } from '@/lib/operations/transitions/workspace-transitions';
import type { CompensationState } from '@/lib/operations/states/compensation-state';
import type { ParticipantState } from '@/lib/operations/states/participant-state';
import type { ProjectState } from '@/lib/operations/states/project-state';
import type { WorkspaceState } from '@/lib/operations/states/workspace-state';

/** Central guard exports for workflow gating (API routes, future automation). */
export const operationalTransitionGuards = {
  workspace: canTransitionWorkspaceState,
  project: canTransitionProjectState,
  participant: canTransitionParticipantState,
  compensation: canTransitionCompensationState,
} as const;

export type OperationalTransitionEntity = keyof typeof operationalTransitionGuards;

export function isValidOperationalTransition(
  entity: OperationalTransitionEntity,
  current: WorkspaceState | ProjectState | ParticipantState | CompensationState,
  target: WorkspaceState | ProjectState | ParticipantState | CompensationState
): boolean {
  const guard = operationalTransitionGuards[entity];
  return guard(current as never, target as never);
}
