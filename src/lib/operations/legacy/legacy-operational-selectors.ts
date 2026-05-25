/**
 * @deprecated Use getOperationalCoordinationSnapshot() or projectGraphSummaryProjection().
 * Legacy payout-readiness counting — retained for backward compatibility only.
 */
export {
  countPayoutReadyParticipants,
  summarizeProjectReadinessGaps,
  deriveParticipantPayoutReadiness,
} from '@/lib/operations/readiness/participant-readiness';

/**
 * @deprecated Use isParticipantPayoutReady from participant-lifecycle only for legacy UI.
 */
export { isParticipantPayoutReady } from '@/lib/operations/truth/payout-truth';

/**
 * @deprecated Use guidanceFromOperationalGraph() / useOperationalGuidance().
 */
export { buildOperationalGuidance, explainOperationalReadiness } from '@/lib/operations/explainability/explain-readiness';

/**
 * @deprecated Use activationFromOperationalGraph().
 */
export { deriveWorkspaceActivationFromOperations } from '@/lib/operations/orchestration/activation-bridge';

/**
 * @deprecated Use deriveReleaseBatchEligibility() from operational graph.
 */
export { deriveReleaseConfidence } from '@/lib/operations/explainability/release-confidence';
