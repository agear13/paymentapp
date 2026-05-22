import type { PayoutReleaseState } from '@/lib/operations/states/payout-release-state';
import { canTransitionState, type TransitionMap } from '@/lib/operations/transitions/transition-utils';

export const PAYOUT_RELEASE_TRANSITIONS: TransitionMap<PayoutReleaseState> = {
  DRAFT: ['VALIDATING', 'BLOCKED'],
  VALIDATING: ['READY', 'BLOCKED', 'FAILED'],
  BLOCKED: ['DRAFT', 'VALIDATING'],
  READY: ['PROCESSING', 'BLOCKED'],
  PROCESSING: ['PARTIALLY_COMPLETED', 'COMPLETED', 'FAILED'],
  PARTIALLY_COMPLETED: ['COMPLETED', 'FAILED', 'REVERSED'],
  COMPLETED: ['REVERSED'],
  FAILED: ['DRAFT', 'VALIDATING'],
  REVERSED: [],
};

export function canTransitionPayoutReleaseState(
  current: PayoutReleaseState,
  target: PayoutReleaseState
): boolean {
  return canTransitionState(PAYOUT_RELEASE_TRANSITIONS, current, target);
}
