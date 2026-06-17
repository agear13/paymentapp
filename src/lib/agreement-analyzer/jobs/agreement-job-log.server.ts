import 'server-only';

import { loggers } from '@/lib/logger';

export type AgreementJobPipelineStage =
  | 'created'
  | 'queued'
  | 'picked_up'
  | 'extraction_started'
  | 'extraction_completed'
  | 'report_saved'
  | 'completed'
  | 'watchdog_failed'
  | 'cron_invoked'
  | 'cron_idle';

export type AgreementJobLogContext = {
  jobId?: string;
  reportId?: string;
  uploadId?: string;
  workerId?: string;
  attemptCount?: number;
  reason?: string;
  processed?: number;
  completed?: number;
  retried?: number;
  failed?: number;
  pendingCount?: number;
  durationMs?: number;
  [key: string]: string | number | boolean | null | undefined;
};

export function logAgreementJobStage(
  stage: AgreementJobPipelineStage,
  context?: AgreementJobLogContext
): void {
  loggers.jobs.info('[agreement-job]', {
    stage,
    ...(context ?? {}),
    timestamp: new Date().toISOString(),
  });
}
