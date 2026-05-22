import type { ParticipantState } from '@/lib/operations/states/participant-state';
import {
  assertTransition,
  canTransitionState,
  type TransitionMap,
} from '@/lib/operations/transitions/transition-utils';

export const PARTICIPANT_TRANSITIONS: TransitionMap<ParticipantState> = {
  INVITED: ['ONBOARDING', 'COMPENSATION_PENDING', 'INACTIVE', 'BLOCKED'],
  ONBOARDING: ['PAYOUT_DETAILS_PENDING', 'COMPENSATION_PENDING', 'BLOCKED', 'INACTIVE'],
  PAYOUT_DETAILS_PENDING: ['COMPENSATION_PENDING', 'READY', 'BLOCKED'],
  COMPENSATION_PENDING: ['READY', 'PAYOUT_DETAILS_PENDING', 'BLOCKED'],
  READY: ['INACTIVE', 'BLOCKED'],
  INACTIVE: ['INVITED', 'ONBOARDING'],
  BLOCKED: ['INVITED', 'ONBOARDING', 'COMPENSATION_PENDING', 'PAYOUT_DETAILS_PENDING'],
};

export function canTransitionParticipantState(
  current: ParticipantState,
  target: ParticipantState
): boolean {
  return canTransitionState(PARTICIPANT_TRANSITIONS, current, target);
}

export function assertParticipantTransition(
  current: ParticipantState,
  target: ParticipantState
) {
  return assertTransition(PARTICIPANT_TRANSITIONS, current, target, 'participant');
}
