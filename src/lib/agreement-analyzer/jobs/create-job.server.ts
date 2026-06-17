import 'server-only';

import { trackAgreementAnalyzerEvent } from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server';
import { logAgreementJobStage } from '@/lib/agreement-analyzer/jobs/agreement-job-log.server';
import {
  AGREEMENT_PROCESSING_JOB_TYPES,
  type AgreementProcessingJobType,
} from '@/lib/agreement-analyzer/jobs/agreement-processing-job-types';
import { prisma } from '@/lib/server/prisma';

export type CreateAgreementProcessingJobInput = {
  uploadId: string;
  reportId: string;
  jobType?: AgreementProcessingJobType;
  maxAttempts?: number;
};

export type CreateAgreementProcessingJobResult = {
  jobId: string;
  created: boolean;
};

export async function createAgreementProcessingJob(
  input: CreateAgreementProcessingJobInput
): Promise<CreateAgreementProcessingJobResult> {
  const existing = await prisma.agreement_processing_jobs.findFirst({
    where: {
      report_id: input.reportId,
      status: { in: ['PENDING', 'PROCESSING'] },
    },
    select: { id: true },
  });

  if (existing) {
    return { jobId: existing.id, created: false };
  }

  const jobType = input.jobType ?? AGREEMENT_PROCESSING_JOB_TYPES.EXTRACTION;

  const job = await prisma.agreement_processing_jobs.create({
    data: {
      upload_id: input.uploadId,
      report_id: input.reportId,
      job_type: jobType,
      status: 'PENDING',
      run_after: new Date(),
      max_attempts: input.maxAttempts ?? 3,
    },
    select: { id: true },
  });

  trackAgreementAnalyzerEvent('agreement_job_created', {
    jobId: job.id,
    uploadId: input.uploadId,
    reportId: input.reportId,
    jobType,
  });

  logAgreementJobStage('created', {
    jobId: job.id,
    uploadId: input.uploadId,
    reportId: input.reportId,
    jobType,
  });

  logAgreementJobStage('queued', {
    jobId: job.id,
    uploadId: input.uploadId,
    reportId: input.reportId,
    jobType,
  });

  return { jobId: job.id, created: true };
}
