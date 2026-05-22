import type { ObligationOperationalReadiness } from '@/lib/projects/funding-sources/types';

export const OBLIGATION_LIFECYCLE_STATES = [
  'NONE',
  'DRAFT',
  'UNFUNDED',
  'PARTIALLY_FUNDED',
  'FUNDED',
  'APPROVED',
  'RELEASE_READY',
  'PAID',
] as const;

export type ObligationLifecycleState = (typeof OBLIGATION_LIFECYCLE_STATES)[number];

export const OBLIGATION_LIFECYCLE_LABELS: Record<ObligationLifecycleState, string> = {
  NONE: 'No obligations',
  DRAFT: 'Draft obligation',
  UNFUNDED: 'Awaiting funding',
  PARTIALLY_FUNDED: 'Partially funded',
  FUNDED: 'Funded',
  APPROVED: 'Approved',
  RELEASE_READY: 'Ready for release',
  PAID: 'Paid',
};

export function obligationStateFromReadiness(
  readiness: ObligationOperationalReadiness,
  amountFunded: number
): ObligationLifecycleState {
  switch (readiness) {
    case 'ready':
      return amountFunded > 0 ? 'FUNDED' : 'APPROVED';
    case 'partially_funded':
      return 'PARTIALLY_FUNDED';
    case 'awaiting_funding':
      return 'UNFUNDED';
    case 'forecast_only':
      return 'DRAFT';
    default:
      return 'UNFUNDED';
  }
}

export function obligationLifecyclePrerequisites(state: ObligationLifecycleState): string[] {
  switch (state) {
    case 'FUNDED':
      return ['Obligation amount covered by confirmed funding'];
    case 'RELEASE_READY':
      return ['Obligation funded', 'Participant payout ready'];
    default:
      return [];
  }
}
