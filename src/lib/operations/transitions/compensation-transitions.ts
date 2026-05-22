import type { CompensationState } from '@/lib/operations/states/compensation-state';
import {
  assertTransition,
  canTransitionState,
  type TransitionMap,
} from '@/lib/operations/transitions/transition-utils';

export const COMPENSATION_TRANSITIONS: TransitionMap<CompensationState> = {
  MISSING: ['DRAFT', 'ARCHIVED'],
  DRAFT: ['CONFIGURED', 'INVALID', 'ARCHIVED'],
  CONFIGURED: ['DRAFT', 'INVALID', 'ARCHIVED'],
  INVALID: ['DRAFT', 'MISSING', 'ARCHIVED'],
  ARCHIVED: [],
};

export function canTransitionCompensationState(
  current: CompensationState,
  target: CompensationState
): boolean {
  return canTransitionState(COMPENSATION_TRANSITIONS, current, target);
}

export function assertCompensationTransition(
  current: CompensationState,
  target: CompensationState
) {
  return assertTransition(COMPENSATION_TRANSITIONS, current, target, 'compensation');
}
