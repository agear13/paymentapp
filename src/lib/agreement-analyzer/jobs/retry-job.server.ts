import 'server-only';

import { trackAgreementAnalyzerEvent } from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server';
import { getAgreementJobRetryDelayMs } from '@/lib/agreement-analyzer/jobs/agreement-processing-job-types';
import { prisma } from '@/lib/server/prisma';

type RetryableJob = {
  id: string;
  upload_id: string;
  report_id: string;
  attempt_count: number;
  max_attempts: number;
};

export async function retryAgreementProcessingJob(
  job: RetryableJob,
  nextAttemptCount: number,
  errorMessage: string
): Promise<Date> {
  const runAfter = new Date(Date.now() + getAgreementJobRetryDelayMs(nextAttemptCount));

  await prisma.$transaction([
    prisma.agreement_processing_jobs.update({
      where: { id: job.id },
      data: {
        status: 'PENDING',
        attempt_count: nextAttemptCount,
        last_error: errorMessage,
        run_after: runAfter,
        locked_at: null,
        locked_by: null,
      },
    }),
    prisma.agreement_obligation_reports.updateMany({
      where: { id: job.report_id, status: 'FAILED' },
      data: { status: 'PENDING' },
    }),
    prisma.agreement_uploads.updateMany({
      where: { id: job.upload_id, upload_status: 'FAILED' },
      data: { upload_status: 'UPLOADED', processed_at: null },
    }),
  ]);

  trackAgreementAnalyzerEvent('agreement_job_retried', {
    jobId: job.id,
    uploadId: job.upload_id,
    reportId: job.report_id,
    attemptCount: nextAttemptCount,
    runAfter: runAfter.toISOString(),
    error: errorMessage,
  });

  return runAfter;
}
