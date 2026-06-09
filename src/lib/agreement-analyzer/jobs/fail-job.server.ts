import 'server-only';

import { trackAgreementAnalyzerEvent } from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server';
import { retryAgreementProcessingJob } from '@/lib/agreement-analyzer/jobs/retry-job.server';
import { prisma } from '@/lib/server/prisma';

export type FailAgreementProcessingJobResult = 'retried' | 'failed';

export async function failAgreementProcessingJob(
  jobId: string,
  errorMessage: string
): Promise<FailAgreementProcessingJobResult> {
  const job = await prisma.agreement_processing_jobs.findUniqueOrThrow({
    where: { id: jobId },
    select: {
      id: true,
      upload_id: true,
      report_id: true,
      attempt_count: true,
      max_attempts: true,
    },
  });

  const nextAttemptCount = job.attempt_count + 1;

  if (nextAttemptCount < job.max_attempts) {
    await retryAgreementProcessingJob(job, nextAttemptCount, errorMessage);
    return 'retried';
  }

  await prisma.agreement_processing_jobs.update({
    where: { id: jobId },
    data: {
      status: 'FAILED',
      attempt_count: nextAttemptCount,
      last_error: errorMessage,
      locked_at: null,
      locked_by: null,
    },
  });

  trackAgreementAnalyzerEvent('agreement_job_failed', {
    jobId: job.id,
    uploadId: job.upload_id,
    reportId: job.report_id,
    attemptCount: nextAttemptCount,
    error: errorMessage,
  });

  return 'failed';
}
