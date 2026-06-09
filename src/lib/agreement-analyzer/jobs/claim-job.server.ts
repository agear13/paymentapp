import 'server-only';

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

    return {
      id: job.id,
      uploadId: job.upload_id,
      reportId: job.report_id,
      jobType: job.job_type,
      attemptCount: job.attempt_count,
      maxAttempts: job.max_attempts,
    };
  });
}
