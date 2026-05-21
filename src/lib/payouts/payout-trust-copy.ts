/** Subtle operator-facing trust signals — use sparingly across payout UI. */
export const PAYOUT_TRUST_COPY = {
  activityRecorded: 'All payout activity is recorded.',
  releaseReviewable:
    'Release batches can be reviewed before participant payouts are finalized.',
  traceableAfterRelease: 'Participant payouts remain traceable after release.',
  hubFooter: 'Payout activity is recorded and reviewable at every step.',
} as const;
