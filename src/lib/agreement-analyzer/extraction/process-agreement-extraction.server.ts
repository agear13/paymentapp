import 'server-only';

import { Prisma } from '@prisma/client';

import type { AgreementAllowedMime } from '@/lib/agreement-analyzer/validation';
import { getAgreementUploadStorage } from '@/lib/agreement-analyzer/upload-storage';
import type { AgreementExtractionFailureJson } from '@/lib/agreement-analyzer/extraction/extraction-types';
import { scheduleReportReadyEmail } from '@/lib/agreement-analyzer/email/send-report-ready-email.server';
import { scheduleLeadScoreCalculation } from '@/lib/agreement-analyzer/scoring/calculate-lead-score.server';
import { enrichReportJsonWithProvvypayFit } from '@/lib/agreement-analyzer/extraction/attach-provvypay-fit.server';
import { enrichReportJsonWithSettlementRiskAssessment } from '@/lib/agreement-analyzer/extraction/attach-settlement-risk-assessment.server';
import { enrichReportJsonWithSettlementSimulation } from '@/lib/agreement-analyzer/extraction/attach-settlement-simulation.server';
import { enrichReportJsonWithExecutiveSummary } from '@/lib/agreement-analyzer/extraction/generate-executive-summary.server';
import { runProductionAgreementExtraction } from '@/lib/agreement-analyzer/extraction/run-production-extraction.server';
import { loggers } from '@/lib/logger';
import { prisma } from '@/lib/server/prisma';

export type ProcessAgreementExtractionResult =
  | { success: true; reportId: string; uploadId: string; extractionId: string }
  | { success: false; reportId: string; uploadId: string; error: string };

type ProcessingContext = {
  reportId: string;
  uploadId: string;
  storageKey: string;
  mimeType: AgreementAllowedMime;
};

async function loadProcessingContext(
  input: { reportId?: string; uploadId?: string }
): Promise<ProcessingContext | null> {
  const report = input.reportId
    ? await prisma.agreement_obligation_reports.findUnique({
        where: { id: input.reportId },
        include: { upload: true },
      })
    : input.uploadId
      ? await prisma.agreement_obligation_reports.findFirst({
          where: { upload_id: input.uploadId, status: 'PENDING' },
          orderBy: { created_at: 'desc' },
          include: { upload: true },
        })
      : null;

  if (!report?.upload) return null;

  return {
    reportId: report.id,
    uploadId: report.upload.id,
    storageKey: report.upload.storage_key,
    mimeType: report.upload.mime_type as AgreementAllowedMime,
  };
}

async function markProcessing(ctx: ProcessingContext): Promise<boolean> {
  const updated = await prisma.agreement_obligation_reports.updateMany({
    where: { id: ctx.reportId, status: 'PENDING' },
    data: { status: 'GENERATING' },
  });
  if (updated.count === 0) {
    return false;
  }

  await prisma.agreement_uploads.update({
    where: { id: ctx.uploadId },
    data: { upload_status: 'PROCESSING' },
  });

  return true;
}

async function persistFailure(
  ctx: ProcessingContext,
  failure: AgreementExtractionFailureJson,
  extractedText: string | null,
  modelName: string | null,
  durationMs: number
): Promise<string> {
  const extraction = await prisma.agreement_ai_extractions.create({
    data: {
      upload_id: ctx.uploadId,
      extracted_text: extractedText,
      extraction_json: failure as Prisma.InputJsonValue,
      confidence_score: null,
      model_name: modelName,
      processing_duration_ms: durationMs,
    },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.agreement_obligation_reports.update({
      where: { id: ctx.reportId },
      data: { status: 'FAILED' },
    }),
    prisma.agreement_uploads.update({
      where: { id: ctx.uploadId },
      data: { upload_status: 'FAILED', processed_at: new Date() },
    }),
  ]);

  return extraction.id;
}

async function persistSuccess(
  ctx: ProcessingContext,
  input: {
    extractedText: string;
    extractionJson: Prisma.InputJsonValue;
    confidenceScore: number;
    modelName: string;
    reportJson: Prisma.InputJsonValue;
    settlementReadinessScore: number;
    durationMs: number;
  }
): Promise<string> {
  const extraction = await prisma.agreement_ai_extractions.create({
    data: {
      upload_id: ctx.uploadId,
      extracted_text: input.extractedText,
      extraction_json: input.extractionJson,
      confidence_score: new Prisma.Decimal(input.confidenceScore.toFixed(4)),
      model_name: input.modelName,
      processing_duration_ms: input.durationMs,
    },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.agreement_obligation_reports.update({
      where: { id: ctx.reportId },
      data: {
        status: 'COMPLETED',
        report_json: input.reportJson,
        settlement_readiness_score: input.settlementReadinessScore,
      },
    }),
    prisma.agreement_uploads.update({
      where: { id: ctx.uploadId },
      data: { upload_status: 'COMPLETED', processed_at: new Date() },
    }),
    prisma.obligation_report_leads.updateMany({
      where: {
        agreement_uploads: { some: { id: ctx.uploadId } },
        lifecycle_stage: 'NEW',
      },
      data: { lifecycle_stage: 'REPORT_GENERATED' },
    }),
  ]);

  return extraction.id;
}

export async function processAgreementExtraction(input: {
  reportId?: string;
  uploadId?: string;
}): Promise<ProcessAgreementExtractionResult> {
  const startedAt = Date.now();
  const ctx = await loadProcessingContext(input);

  if (!ctx) {
    return {
      success: false,
      reportId: input.reportId ?? '',
      uploadId: input.uploadId ?? '',
      error: 'Pending report or upload not found.',
    };
  }

  const claimed = await markProcessing(ctx);
  if (!claimed) {
    return {
      success: false,
      reportId: ctx.reportId,
      uploadId: ctx.uploadId,
      error: 'Report is already processing or completed.',
    };
  }

  try {
    const storage = getAgreementUploadStorage();
    let bytes: Buffer;
    try {
      ({ bytes } = await storage.download(ctx.storageKey));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load agreement file.';
      const durationMs = Date.now() - startedAt;
      const failure: AgreementExtractionFailureJson = {
        success: false,
        error: message,
        stage: 'load_file',
      };
      const extractionId = await persistFailure(ctx, failure, null, null, durationMs);
      loggers.api.error('Agreement extraction failed', error, {
        reportId: ctx.reportId,
        uploadId: ctx.uploadId,
        extractionId,
        stage: failure.stage,
        durationMs,
      });
      return {
        success: false,
        reportId: ctx.reportId,
        uploadId: ctx.uploadId,
        error: message,
      };
    }

    const extractionResult = await runProductionAgreementExtraction({
      bytes,
      mimeType: ctx.mimeType,
    });
    const durationMs = Date.now() - startedAt;

    if (extractionResult.success) {
      const reportWithSummary = await enrichReportJsonWithExecutiveSummary({
        extractionJson: extractionResult.extraction,
        reportJson: extractionResult.reportJson,
        settlementReadinessScore: extractionResult.reportJson.settlementReadiness.score,
      });
      const reportWithSimulation = enrichReportJsonWithSettlementSimulation({
        reportJson: reportWithSummary,
        extractionJson: extractionResult.extraction,
      });
      const reportWithFit = enrichReportJsonWithProvvypayFit({
        reportJson: reportWithSimulation,
        extractionJson: extractionResult.extraction,
      });
      const reportJson = enrichReportJsonWithSettlementRiskAssessment({
        reportJson: reportWithFit,
        extractionJson: extractionResult.extraction,
      });

      const extractionId = await persistSuccess(ctx, {
        extractedText: extractionResult.extractedText,
        extractionJson: extractionResult.extraction as Prisma.InputJsonValue,
        confidenceScore: extractionResult.extraction.confidenceScore,
        modelName: extractionResult.modelName,
        reportJson: reportJson as Prisma.InputJsonValue,
        settlementReadinessScore: reportJson.settlementReadiness.score,
        durationMs,
      });

      loggers.api.info('Agreement extraction completed', {
        reportId: ctx.reportId,
        uploadId: ctx.uploadId,
        extractionId,
        durationMs,
        modelName: extractionResult.modelName,
        providerId: extractionResult.providerId,
      });

      scheduleReportReadyEmail(ctx.reportId);
      scheduleLeadScoreCalculation(ctx.reportId);

      return {
        success: true,
        reportId: ctx.reportId,
        uploadId: ctx.uploadId,
        extractionId,
      };
    }

    const failure: AgreementExtractionFailureJson = {
      success: false,
      error: extractionResult.error,
      stage: extractionResult.stage,
    };
    const extractionId = await persistFailure(
      ctx,
      failure,
      extractionResult.extractedText,
      extractionResult.modelName,
      durationMs
    );

    loggers.api.error('Agreement extraction failed', new Error(extractionResult.error), {
      reportId: ctx.reportId,
      uploadId: ctx.uploadId,
      extractionId,
      stage: extractionResult.stage,
      durationMs,
      providerId: extractionResult.providerId,
    });

    return {
      success: false,
      reportId: ctx.reportId,
      uploadId: ctx.uploadId,
      error: extractionResult.error,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : 'Unknown extraction error';
    const failure: AgreementExtractionFailureJson = {
      success: false,
      error: message,
      stage: 'persistence',
    };
    const extractionId = await persistFailure(ctx, failure, null, null, durationMs);

    loggers.api.error('Agreement extraction failed', error, {
      reportId: ctx.reportId,
      uploadId: ctx.uploadId,
      extractionId,
      stage: failure.stage,
      durationMs,
    });

    return {
      success: false,
      reportId: ctx.reportId,
      uploadId: ctx.uploadId,
      error: message,
    };
  }
}

export async function processPendingAgreementExtractions(limit = 10): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const pending = await prisma.agreement_obligation_reports.findMany({
    where: { status: 'PENDING' },
    orderBy: { created_at: 'asc' },
    take: limit,
    select: { id: true },
  });

  let succeeded = 0;
  let failed = 0;

  for (const report of pending) {
    const result = await processAgreementExtraction({ reportId: report.id });
    if (result.success) succeeded += 1;
    else failed += 1;
  }

  return { processed: pending.length, succeeded, failed };
}

