import type { SettlementBatchState } from '@/lib/operations/states/settlement-batch-state';
import { canTransitionState, type TransitionMap } from '@/lib/operations/transitions/transition-utils';

export const SETTLEMENT_BATCH_TRANSITIONS: TransitionMap<SettlementBatchState> = {
  OPEN: ['RECONCILING', 'FAILED'],
  RECONCILING: ['SETTLING', 'FAILED'],
  SETTLING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: ['OPEN', 'RECONCILING'],
};

export function canTransitionSettlementBatchState(
  current: SettlementBatchState,
  target: SettlementBatchState
): boolean {
  return canTransitionState(SETTLEMENT_BATCH_TRANSITIONS, current, target);
}
