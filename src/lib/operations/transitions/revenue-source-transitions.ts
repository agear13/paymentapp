import type { RevenueSourceState } from '@/lib/operations/states/revenue-source-state';
import { canTransitionState, type TransitionMap } from '@/lib/operations/transitions/transition-utils';

export const REVENUE_SOURCE_TRANSITIONS: TransitionMap<RevenueSourceState> = {
  DRAFT: ['PENDING_COLLECTION', 'FAILED'],
  PENDING_COLLECTION: ['COLLECTED', 'FAILED', 'DRAFT'],
  COLLECTED: ['HELD', 'ALLOCATED', 'REFUNDED'],
  HELD: ['ALLOCATED', 'RELEASED', 'REFUNDED'],
  ALLOCATED: ['RELEASED'],
  RELEASED: [],
  FAILED: ['DRAFT', 'PENDING_COLLECTION'],
  REFUNDED: [],
};

export function canTransitionRevenueSourceState(
  current: RevenueSourceState,
  target: RevenueSourceState
): boolean {
  return canTransitionState(REVENUE_SOURCE_TRANSITIONS, current, target);
}
