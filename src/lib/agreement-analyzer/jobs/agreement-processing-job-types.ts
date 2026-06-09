export const AGREEMENT_PROCESSING_JOB_TYPES = {
  EXTRACTION: 'EXTRACTION',
} as const;

export type AgreementProcessingJobType =
  (typeof AGREEMENT_PROCESSING_JOB_TYPES)[keyof typeof AGREEMENT_PROCESSING_JOB_TYPES];

export const AGREEMENT_JOB_BACKOFF_MINUTES = [1, 5, 15] as const;

export function getAgreementJobRetryDelayMs(attemptCount: number): number {
  const index = Math.min(
    Math.max(attemptCount - 1, 0),
    AGREEMENT_JOB_BACKOFF_MINUTES.length - 1
  );
  return AGREEMENT_JOB_BACKOFF_MINUTES[index] * 60 * 1000;
}
