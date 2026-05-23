import type { ObligationLifecycleState } from '@/lib/operations/lifecycle/obligation-lifecycle';
import type { ObligationOperationalReadiness } from '@/lib/projects/funding-sources/types';

/** Operational obligation contract — presentation-safe shape. */
export type HydratedObligation = {
  id: string;
  lifecycle: ObligationLifecycleState;
  readiness: ObligationOperationalReadiness;
  amount: number;
  amountFunded: number;
  currency: string;
  participantId?: string | null;
  operational: {
    releaseReady: boolean;
    needsFunding: boolean;
  };
  metadata: {
    contractVersion: typeof OBLIGATION_CONTRACT_VERSION;
    source?: 'draft' | 'hydrated' | 'legacy';
  };
};

export const OBLIGATION_CONTRACT_VERSION = 1 as const;
