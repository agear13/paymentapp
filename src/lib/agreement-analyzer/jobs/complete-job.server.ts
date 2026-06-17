import 'server-only';

import { trackAgreementAnalyzerEvent } from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server';
import { logAgreementJobStage } from '@/lib/agreement-analyzer/jobs/agreement-job-log.server';
import { prisma } from '@/lib/server/prisma';

export async function completeAgreementProcessingJob(jobId: string): Promise<void> {
  const job = await prisma.agreement_processing_jobs.update({
    where: { id: jobId },
    data: {
      status: 'COMPLETED',
      completed_at: new Date(),
      locked_at: null,
      locked_by: null,
      last_error: null,
    },
    select: {
      id: true,
      upload_id: true,
      report_id: true,
      attempt_count: true,
      created_at: true,
      completed_at: true,
    },
  });

  const processingTimeMs =
    job.completed_at != null
      ? job.completed_at.getTime() - job.created_at.getTime()
      : null;

  trackAgreementAnalyzerEvent('agreement_job_completed', {
    jobId: job.id,
    uploadId: job.upload_id,
    reportId: job.report_id,
    attemptCount: job.attempt_count,
    processingTimeMs,
  });

  logAgreementJobStage('completed', {
    jobId: job.id,
    uploadId: job.upload_id,
    reportId: job.report_id,
    attemptCount: job.attempt_count,
    durationMs: processingTimeMs ?? undefined,
  });
}
