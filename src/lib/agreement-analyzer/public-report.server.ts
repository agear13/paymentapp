import 'server-only';

import { trackAgreementAnalyzerEvent } from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server';
import { getLeadAttributionAnalyticsProperties } from '@/lib/agreement-analyzer/attribution/lead-attribution.server';
import { buildCalendlyDemoBookingLink } from '@/lib/agreement-analyzer/calendly/calendly-attribution.server';
import type { AgreementExtractionFailureJson } from '@/lib/agreement-analyzer/extraction/extraction-types';
import {
  isValidReportAccessToken,
  parsePublicReportJson,
  type PublicObligationReportPayload,
} from '@/lib/agreement-analyzer/report-types';
import { prisma } from '@/lib/server/prisma';

function parseFailureMessage(extractionJson: unknown): string | null {
  if (!extractionJson || typeof extractionJson !== 'object') return null;
  const record = extractionJson as AgreementExtractionFailureJson & { error?: string };
  if (record.success === false && typeof record.error === 'string') {
    return record.error;
  }
  return null;
}

export async function getPublicObligationReportByToken(
  token: string
): Promise<PublicObligationReportPayload | null> {
  const reportAccessToken = token.trim();
  if (!isValidReportAccessToken(reportAccessToken)) {
    return null;
  }

  const report = await prisma.agreement_obligation_reports.findUnique({
    where: { report_access_token: reportAccessToken },
    include: {
      upload: {
        include: {
          lead: {
            select: {
              id: true,
              company_name: true,
              business_type: true,
              obligation_report_lead_scores: {
                orderBy: { created_at: 'desc' },
                take: 1,
                select: {
                  overall_score: true,
                  priority_band: true,
                  recommended_use_case: true,
                },
              },
            },
          },
          agreement_ai_extractions: {
            orderBy: { created_at: 'desc' },
            take: 1,
            select: { extraction_json: true },
          },
        },
      },
    },
  });

  if (!report) return null;

  const latestExtraction = report.upload.agreement_ai_extractions[0];
  const failureMessage =
    report.status === 'FAILED' ? parseFailureMessage(latestExtraction?.extraction_json) : null;
  const latestScore = report.upload.lead.obligation_report_lead_scores[0] ?? null;

  const demoBooking =
    report.status === 'COMPLETED'
      ? (() => {
          const booking = buildCalendlyDemoBookingLink({
            leadId: report.upload.lead.id,
            reportId: report.id,
            overallScore: latestScore?.overall_score ?? null,
            priorityBand: latestScore?.priority_band ?? null,
            recommendedUseCase: latestScore?.recommended_use_case ?? null,
          });

          return {
            url: booking.url,
            leadId: report.upload.lead.id,
            reportId: report.id,
            overallScore: latestScore?.overall_score ?? null,
            priorityBand: latestScore?.priority_band ?? null,
            recommendedUseCase: latestScore?.recommended_use_case ?? null,
          };
        })()
      : null;

  return {
    status: report.status,
    reportAccessToken: report.report_access_token ?? reportAccessToken,
    createdAt: report.created_at.toISOString(),
    viewedAt: report.viewed_at?.toISOString() ?? null,
    settlementReadinessScore: report.settlement_readiness_score,
    document: {
      filename: report.upload.original_filename,
      companyName: report.upload.lead.company_name,
      businessType: report.upload.lead.business_type,
    },
    report: parsePublicReportJson(report.report_json),
    failureMessage,
    demoBooking,
  };
}

export async function markObligationReportViewed(reportAccessToken: string): Promise<void> {
  const report = await prisma.agreement_obligation_reports.findUnique({
    where: { report_access_token: reportAccessToken },
    select: {
      id: true,
      status: true,
      viewed_at: true,
      upload: { select: { lead_id: true } },
    },
  });

  if (!report || report.status !== 'COMPLETED' || report.viewed_at) {
    return;
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.agreement_obligation_reports.update({
      where: { id: report.id },
      data: { viewed_at: now },
    }),
    prisma.obligation_report_leads.updateMany({
      where: {
        id: report.upload.lead_id,
        lifecycle_stage: { in: ['NEW', 'REPORT_GENERATED'] },
      },
      data: { lifecycle_stage: 'REPORT_VIEWED' },
    }),
  ]);

  const attribution = await getLeadAttributionAnalyticsProperties(report.upload.lead_id);

  trackAgreementAnalyzerEvent('agreement_report_viewed', {
    leadId: report.upload.lead_id,
    reportId: report.id,
    reportAccessToken,
    ...attribution,
  });
}
