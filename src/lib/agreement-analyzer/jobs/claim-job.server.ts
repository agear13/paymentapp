import 'server-only';

import { logAgreementJobStage } from '@/lib/agreement-analyzer/jobs/agreement-job-log.server';
import { prisma } from '@/lib/server/prisma';

export type ClaimedAgreementProcessingJob = {
  id: string;
  uploadId: string;
  reportId: string;
  jobType: string;
  attemptCount: number;
  maxAttempts: number;
};

export async function claimAgreementProcessingJob(
  workerId: string
): Promise<ClaimedAgreementProcessingJob | null> {
  return prisma.$transaction(async (tx) => {
    const pick = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM agreement_processing_jobs
      WHERE status = 'PENDING'
        AND run_after <= NOW()
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    if (pick.length === 0) {
      return null;
    }

    const job = await tx.agreement_processing_jobs.update({
      where: { id: pick[0].id },
      data: {
        status: 'PROCESSING',
        locked_at: new Date(),
        locked_by: workerId,
      },
    });

    const claimed = {
      id: job.id,
      uploadId: job.upload_id,
      reportId: job.report_id,
      jobType: job.job_type,
      attemptCount: job.attempt_count,
      maxAttempts: job.max_attempts,
    };

    logAgreementJobStage('picked_up', {
      jobId: claimed.id,
      uploadId: claimed.uploadId,
      reportId: claimed.reportId,
      workerId,
      attemptCount: claimed.attemptCount,
      jobType: claimed.jobType,
    });

    return claimed;
  });
}
