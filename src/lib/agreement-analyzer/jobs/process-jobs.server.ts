import 'server-only';

import { trackAgreementAnalyzerEvent } from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server';
import { claimAgreementProcessingJob } from '@/lib/agreement-analyzer/jobs/claim-job.server';
import { completeAgreementProcessingJob } from '@/lib/agreement-analyzer/jobs/complete-job.server';
import { failAgreementProcessingJob } from '@/lib/agreement-analyzer/jobs/fail-job.server';
import {
  processAgreementExtraction,
  type ProcessAgreementExtractionResult,
} from '@/lib/agreement-analyzer/extraction/process-agreement-extraction.server';

export type ProcessAgreementJobOutcome = 'idle' | 'completed' | 'retried' | 'failed';

export type ProcessAgreementJobsBatchResult = {
  processed: number;
  completed: number;
  retried: number;
  failed: number;
};

type ProcessAgreementExtractionFn = (input: {
  reportId?: string;
  uploadId?: string;
}) => Promise<ProcessAgreementExtractionResult>;

export async function processNextAgreementProcessingJob(
  workerId: string,
  options?: { processExtraction?: ProcessAgreementExtractionFn }
): Promise<ProcessAgreementJobOutcome> {
  const runExtraction = options?.processExtraction ?? processAgreementExtraction;
  const job = await claimAgreementProcessingJob(workerId);

  if (!job) {
    return 'idle';
  }

  trackAgreementAnalyzerEvent('agreement_job_started', {
    jobId: job.id,
    uploadId: job.uploadId,
    reportId: job.reportId,
    attemptCount: job.attemptCount,
    workerId,
  });

  const result = await runExtraction({ reportId: job.reportId });

  if (result.success) {
    await completeAgreementProcessingJob(job.id);
    return 'completed';
  }

  const failureOutcome = await failAgreementProcessingJob(job.id, result.error);
  return failureOutcome;
}

export async function processAgreementProcessingJobsBatch(
  workerId: string,
  limit = 10,
  options?: { processExtraction?: ProcessAgreementExtractionFn }
): Promise<ProcessAgreementJobsBatchResult> {
  let processed = 0;
  let completed = 0;
  let retried = 0;
  let failed = 0;

  for (let index = 0; index < limit; index += 1) {
    const outcome = await processNextAgreementProcessingJob(workerId, options);
    if (outcome === 'idle') {
      break;
    }

    processed += 1;
    if (outcome === 'completed') completed += 1;
    else if (outcome === 'retried') retried += 1;
    else if (outcome === 'failed') failed += 1;
  }

  return { processed, completed, retried, failed };
}
