/**
 * @deprecated Import from `@/lib/operations` — thin compatibility re-export.
 */
export {
  deriveParticipantPayoutReadiness as deriveParticipantReadiness,
  countPayoutReadyParticipants,
  summarizeProjectReadinessGaps,
  type ParticipantPayoutReadiness as ParticipantReadinessSnapshot,
  type ProjectReadinessGapSummary,
} from '@/lib/operations/readiness/participant-readiness';
