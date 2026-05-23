import type { AttributionLifecycleState } from '@/lib/operations/lifecycle/attribution-lifecycle';

/** Operational attribution contract — presentation-safe flags. */
export type OperationalAttributionContract = {
  enabled: boolean;
  active: boolean;
  linkGenerated: boolean;
  lifecycle: AttributionLifecycleState;
};

export const ATTRIBUTION_CONTRACT_VERSION = 1 as const;
