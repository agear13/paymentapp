import type { FundingCoordinationStage } from '@/lib/operations/truth/funding-coordination-semantics';

/** Canonical funding lifecycle — all labels and blockers derive from this state machine. */
export const CANONICAL_FUNDING_LIFECYCLE = [
  'UNLINKED',
  'SOURCE_CONNECTED',
  'FUNDING_RESERVED',
  'FUNDING_SETTLED',
  'RELEASE_FUNDED',
  'RELEASED',
] as const;

export type CanonicalFundingLifecycle = (typeof CANONICAL_FUNDING_LIFECYCLE)[number];

export const FUNDING_LIFECYCLE_LABELS: Record<CanonicalFundingLifecycle, string> = {
  UNLINKED: 'No funding source added',
  SOURCE_CONNECTED: 'Funding source added',
  FUNDING_RESERVED: 'Funding reserved',
  FUNDING_SETTLED: 'Funding settled',
  RELEASE_FUNDED: 'Release funded',
  RELEASED: 'Released',
};

export function deriveCanonicalFundingLifecycle(
  stage: FundingCoordinationStage | null,
  released = false
): CanonicalFundingLifecycle {
  if (released) return 'RELEASED';
  if (!stage || !stage.fundingSourceConnected) return 'UNLINKED';
  if (stage.releaseFunded) return 'RELEASE_FUNDED';
  if (stage.fundingSettled) return 'FUNDING_SETTLED';
  if (stage.fundingReserved) return 'FUNDING_RESERVED';
  return 'SOURCE_CONNECTED';
}

export function fundingLifecycleLabel(state: CanonicalFundingLifecycle): string {
  return FUNDING_LIFECYCLE_LABELS[state];
}

export function fundingLifecycleBlocker(
  state: CanonicalFundingLifecycle
): string | null {
  switch (state) {
    case 'UNLINKED':
      return 'Connect a funding source';
    case 'SOURCE_CONNECTED':
      return 'Funding not yet reserved against obligations';
    case 'FUNDING_RESERVED':
      return 'Funding reserved but not yet settled for obligations';
    case 'FUNDING_SETTLED':
      return 'Funding secured. Allocation to payout obligations pending.';
    default:
      return null;
  }
}
