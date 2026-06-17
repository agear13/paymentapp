import 'server-only';

import { Prisma } from '@prisma/client';

import type { AgreementExtractionFailureJson } from '@/lib/agreement-analyzer/extraction/extraction-types';
import { logAgreementJobStage } from '@/lib/agreement-analyzer/jobs/agreement-job-log.server';
import { trackAgreementAnalyzerEvent } from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server';
import { prisma } from '@/lib/server/prisma';

/** Fail reports stuck in PENDING when no worker has picked up processing. */
export const AGREEMENT_REPORT_WATCHDOG_AGE_MS = 2 * 60 * 1000;

export const AGREEMENT_REPORT_WATCHDOG_REASON =
  'Report remained PENDING for over 2 minutes without worker pickup. ' +
  'Verify Render cron service provvypay-cron-agreement-analyzer-jobs, CRON_SECRET, and CRON_BASE_URL.';

export type AgreementReportWatchdogResult = {
  failedReportIds: string[];
  failedCount: number;
};

export async function failStalePendingAgreementReports(
  now = Date.now()
): Promise<AgreementReportWatchdogResult> {
  const cutoff = new Date(now - AGREEMENT_REPORT_WATCHDOG_AGE_MS);

  const staleReports = await prisma.agreement_obligation_reports.findMany({
    where: {
      status: 'PENDING',
      created_at: { lt: cutoff },
    },
    orderBy: { created_at: 'asc' },
    select: {
      id: true,
      upload_id: true,
      created_at: true,
      agreement_processing_jobs: {
        where: { status: { in: ['PENDING', 'PROCESSING'] } },
        select: { id: true, status: true },
      },
    },
  });

  const failedReportIds: string[] = [];

  for (const report of staleReports) {
    const ageMs = now - report.created_at.getTime();
    const failure: AgreementExtractionFailureJson = {
      success: false,
      error: AGREEMENT_REPORT_WATCHDOG_REASON,
      stage: 'watchdog',
    };

    await prisma.$transaction(async (tx) => {
      await tx.agreement_ai_extractions.create({
        data: {
          upload_id: report.upload_id,
          extracted_text: null,
          extraction_json: failure as Prisma.InputJsonValue,
          confidence_score: null,
          model_name: null,
          processing_duration_ms: ageMs,
        },
      });

      await tx.agreement_obligation_reports.update({
        where: { id: report.id },
        data: { status: 'FAILED' },
      });

      await tx.agreement_uploads.update({
        where: { id: report.upload_id },
        data: { upload_status: 'FAILED', processed_at: new Date() },
      });

      if (report.agreement_processing_jobs.length > 0) {
        await tx.agreement_processing_jobs.updateMany({
          where: {
            id: { in: report.agreement_processing_jobs.map((job) => job.id) },
          },
          data: {
            status: 'FAILED',
            last_error: AGREEMENT_REPORT_WATCHDOG_REASON,
            locked_at: null,
            locked_by: null,
          },
        });
      }
    });

    failedReportIds.push(report.id);

    logAgreementJobStage('watchdog_failed', {
      reportId: report.id,
      uploadId: report.upload_id,
      reason: AGREEMENT_REPORT_WATCHDOG_REASON,
      ageMs,
      pendingJobCount: report.agreement_processing_jobs.length,
    });

    trackAgreementAnalyzerEvent('agreement_job_failed', {
      reportId: report.id,
      uploadId: report.upload_id,
      error: AGREEMENT_REPORT_WATCHDOG_REASON,
      stage: 'watchdog',
      ageMs,
    });
  }

  return {
    failedReportIds,
    failedCount: failedReportIds.length,
  };
}
