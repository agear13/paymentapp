import type { ObligationState } from '@/lib/operations/states/obligation-state';
import { canTransitionState, type TransitionMap } from '@/lib/operations/transitions/transition-utils';

export const OBLIGATION_TRANSITIONS: TransitionMap<ObligationState> = {
  DRAFT: ['CALCULATED', 'VOIDED'],
  CALCULATED: ['PENDING_APPROVAL', 'VOIDED'],
  PENDING_APPROVAL: ['APPROVED', 'VOIDED'],
  APPROVED: ['FUNDED', 'VOIDED'],
  FUNDED: ['RELEASED', 'FAILED'],
  RELEASED: [],
  FAILED: ['FUNDED', 'VOIDED'],
  VOIDED: [],
};

export function canTransitionObligationState(
  current: ObligationState,
  target: ObligationState
): boolean {
  return canTransitionState(OBLIGATION_TRANSITIONS, current, target);
}
