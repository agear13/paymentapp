import type { TransitionExplanation } from '@/lib/operations/explainability/types';
import { PROJECT_STATE_LABELS } from '@/lib/operations/states/project-state';
import type { ProjectState } from '@/lib/operations/states/project-state';
import { WORKSPACE_STATE_LABELS } from '@/lib/operations/states/workspace-state';
import type { WorkspaceState } from '@/lib/operations/states/workspace-state';

export function explainProjectTransition(
  from: ProjectState | null,
  to: ProjectState,
  reasons: string[]
): TransitionExplanation {
  return {
    entityLabel: 'Project',
    fromState: from ? PROJECT_STATE_LABELS[from] : 'Previous state',
    toState: PROJECT_STATE_LABELS[to],
    title: `Project moved to ${PROJECT_STATE_LABELS[to]}`,
    reasons: reasons.length > 0 ? reasons : ['Operational requirements met for this phase'],
  };
}

export function explainWorkspaceTransition(
  from: WorkspaceState | null,
  to: WorkspaceState,
  reasons: string[]
): TransitionExplanation {
  return {
    entityLabel: 'Workspace',
    fromState: from ? WORKSPACE_STATE_LABELS[from] : 'Previous state',
    toState: WORKSPACE_STATE_LABELS[to],
    title: `Workspace phase: ${WORKSPACE_STATE_LABELS[to]}`,
    reasons: reasons.length > 0 ? reasons : ['Workspace coordination progressed'],
  };
}
