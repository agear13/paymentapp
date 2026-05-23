import type { FundingLifecycleState } from '@/lib/operations/lifecycle/funding-lifecycle';

/** Operational funding contract — treasury presentation shape. */
export type HydratedFunding = {
  lifecycle: FundingLifecycleState;
  confirmedAmount: number;
  pendingAmount: number;
  obligationsTotal: number;
  currency: string;
  fullyAllocated: boolean;
  metadata: {
    contractVersion: typeof FUNDING_CONTRACT_VERSION;
    source?: 'draft' | 'hydrated' | 'legacy';
  };
};

export const FUNDING_CONTRACT_VERSION = 1 as const;
