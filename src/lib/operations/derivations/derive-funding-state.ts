import type { HydratedFunding } from '@/lib/operations/contracts/funding-contract';
import { FUNDING_CONTRACT_VERSION } from '@/lib/operations/contracts/funding-contract';
import { deriveFundingLifecycleState } from '@/lib/operations/lifecycle/funding-lifecycle';

export type RawFundingInput = {
  confirmedFunding?: number;
  pendingFunding?: number;
  obligationsTotal?: number;
  currency?: string;
};

/** Pure funding operational state — no UI logic. */
export function deriveFundingState(input: RawFundingInput): HydratedFunding {
  const confirmedAmount = Number.isFinite(input.confirmedFunding)
    ? (input.confirmedFunding as number)
    : 0;
  const pendingAmount = Number.isFinite(input.pendingFunding)
    ? (input.pendingFunding as number)
    : 0;
  const obligationsTotal = Number.isFinite(input.obligationsTotal)
    ? (input.obligationsTotal as number)
    : 0;
  const lifecycle = deriveFundingLifecycleState(
    confirmedAmount,
    obligationsTotal,
    pendingAmount
  );

  return {
    lifecycle,
    confirmedAmount,
    pendingAmount,
    obligationsTotal,
    currency: input.currency ?? 'AUD',
    fullyAllocated:
      obligationsTotal > 0 && confirmedAmount + 0.005 >= obligationsTotal,
    metadata: {
      contractVersion: FUNDING_CONTRACT_VERSION,
      source: 'hydrated',
    },
  };
}
