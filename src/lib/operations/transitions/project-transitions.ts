import type { ProjectState } from '@/lib/operations/states/project-state';
import {
  assertTransition,
  canTransitionState,
  type TransitionMap,
} from '@/lib/operations/transitions/transition-utils';

export const PROJECT_TRANSITIONS: TransitionMap<ProjectState> = {
  DRAFT: ['CONFIGURING', 'BLOCKED'],
  CONFIGURING: ['FUNDING_PENDING', 'BLOCKED'],
  FUNDING_PENDING: ['ALLOCATIONS_PENDING', 'BLOCKED'],
  ALLOCATIONS_PENDING: ['OBLIGATIONS_PENDING', 'BLOCKED'],
  OBLIGATIONS_PENDING: ['READY_FOR_RELEASE', 'BLOCKED'],
  READY_FOR_RELEASE: ['RELEASE_IN_PROGRESS', 'BLOCKED'],
  RELEASE_IN_PROGRESS: ['SETTLING', 'BLOCKED'],
  SETTLING: ['SETTLED', 'BLOCKED'],
  SETTLED: ['ARCHIVED'],
  BLOCKED: [
    'CONFIGURING',
    'FUNDING_PENDING',
    'ALLOCATIONS_PENDING',
    'OBLIGATIONS_PENDING',
    'READY_FOR_RELEASE',
  ],
  ARCHIVED: [],
};

export function canTransitionProjectState(
  current: ProjectState,
  target: ProjectState
): boolean {
  if (target === 'BLOCKED' && current !== 'ARCHIVED' && current !== 'SETTLED') return true;
  return canTransitionState(PROJECT_TRANSITIONS, current, target);
}

export function assertProjectTransition(current: ProjectState, target: ProjectState) {
  if (target === 'BLOCKED' && current !== 'ARCHIVED' && current !== 'SETTLED') {
    return { ok: true as const };
  }
  return assertTransition(PROJECT_TRANSITIONS, current, target, 'project');
}
