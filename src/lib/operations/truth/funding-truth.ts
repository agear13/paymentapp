import type { TreasuryInputs } from '@/lib/projects/funding-sources/treasury-summary';
import { recalculateOperationalFundingState } from '@/lib/operations/lifecycle/funding-lifecycle';

export function isFundingOperationallyAllocated(input: TreasuryInputs): boolean {
  const state = recalculateOperationalFundingState(input);
  return (
    state.fundingState === 'ALLOCATED' ||
    state.treasury.operationalReadiness === 'ready'
  );
}

export { recalculateOperationalFundingState };
