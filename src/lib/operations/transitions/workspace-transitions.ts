import type { WorkspaceState } from '@/lib/operations/states/workspace-state';
import {
  assertTransition,
  canTransitionState,
  type TransitionMap,
} from '@/lib/operations/transitions/transition-utils';

/**
 * Allowed workspace transitions.
 * DEGRADED may return to prior active paths when blockers clear.
 */
export const WORKSPACE_TRANSITIONS: TransitionMap<WorkspaceState> = {
  DRAFT: ['CONFIGURING', 'ARCHIVED'],
  CONFIGURING: ['COLLECTING', 'DEGRADED', 'ARCHIVED'],
  COLLECTING: ['COORDINATING', 'DEGRADED', 'ARCHIVED'],
  COORDINATING: ['READY_FOR_SETTLEMENT', 'DEGRADED', 'ARCHIVED'],
  READY_FOR_SETTLEMENT: ['ACTIVE', 'DEGRADED', 'ARCHIVED'],
  ACTIVE: ['DEGRADED', 'ARCHIVED'],
  DEGRADED: ['CONFIGURING', 'COLLECTING', 'COORDINATING', 'ACTIVE', 'ARCHIVED'],
  ARCHIVED: [],
};

export function canTransitionWorkspaceState(
  current: WorkspaceState,
  target: WorkspaceState
): boolean {
  return canTransitionState(WORKSPACE_TRANSITIONS, current, target);
}

export function assertWorkspaceTransition(
  current: WorkspaceState,
  target: WorkspaceState
) {
  return assertTransition(WORKSPACE_TRANSITIONS, current, target, 'workspace');
}
