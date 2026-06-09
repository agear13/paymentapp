import 'server-only';

import type { ObligationReportLeadLifecycleStage } from '@prisma/client';

import { trackAgreementAnalyzerEvent } from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server';
import { getLeadAttributionAnalyticsProperties } from '@/lib/agreement-analyzer/attribution/lead-attribution.server';
import { computeLeadScore } from '@/lib/agreement-analyzer/scoring/lead-scoring-engine';
import type { LeadScoreComputation } from '@/lib/agreement-analyzer/scoring/lead-scoring-types';
import { loggers } from '@/lib/logger';
import { prisma } from '@/lib/server/prisma';

const REPORT_VIEWED_STAGES: ObligationReportLeadLifecycleStage[] = [
  'REPORT_VIEWED',
  'DEMO_BOOKED',
  'QUALIFIED',
  'CUSTOMER',
];

const DEMO_BOOKED_STAGES: ObligationReportLeadLifecycleStage[] = [
  'DEMO_BOOKED',
  'QUALIFIED',
  'CUSTOMER',
];

async function loadEngagementSignals(leadId: string, reportViewedAt: Date | null) {
  const [lead, emailEvents] = await Promise.all([
    prisma.obligation_report_leads.findUnique({
      where: { id: leadId },
      select: { lifecycle_stage: true },
    }),
    prisma.obligation_report_email_events.findMany({
      where: { lead_id: leadId, email_type: 'REPORT_READY' },
      select: { opened_at: true, clicked_at: true },
    }),
  ]);

  const reportViewed =
    reportViewedAt != null ||
    (lead?.lifecycle_stage ? REPORT_VIEWED_STAGES.includes(lead.lifecycle_stage) : false);
  const emailOpened = emailEvents.some((event) => event.opened_at != null);
  const emailClicked = emailEvents.some((event) => event.clicked_at != null);
  const demoBooked =
    lead?.lifecycle_stage != null && DEMO_BOOKED_STAGES.includes(lead.lifecycle_stage);
  const demoClicked = emailClicked || demoBooked;

  return {
    reportViewed,
    emailOpened,
    emailClicked,
    demoClicked,
    demoBooked,
  };
}

export async function calculateLeadScore(input: {
  reportId: string;
}): Promise<(LeadScoreComputation & { leadId: string; scoreId: string }) | null> {
  const report = await prisma.agreement_obligation_reports.findUnique({
    where: { id: input.reportId },
    include: {
      upload: {
        include: {
          lead: { select: { id: true } },
          agreement_ai_extractions: {
            orderBy: { created_at: 'desc' },
            take: 1,
            select: { extraction_json: true },
          },
        },
      },
    },
  });

  if (!report || report.status !== 'COMPLETED' || !report.report_json) {
    return null;
  }

  const leadId = report.upload.lead.id;
  const extractionJson = report.upload.agreement_ai_extractions[0]?.extraction_json ?? null;
  const engagement = await loadEngagementSignals(leadId, report.viewed_at);

  const computation = computeLeadScore({
    extractionJson,
    reportJson: report.report_json,
    engagement,
  });

  const scoreRecord = await prisma.obligation_report_lead_scores.create({
    data: {
      lead_id: leadId,
      complexity_score: computation.settlementComplexityScore,
      revenue_share_detected: computation.signals.revenueShareDetected,
      hospitality_detected: computation.signals.hospitalityDetected,
      event_detected: computation.signals.eventDetected,
      accountant_detected: computation.signals.accountantDetected,
      multi_party_detected: computation.signals.multiPartyDetected,
      party_count: computation.signals.partyCount,
      obligation_count: computation.signals.obligationCount,
      risk_count: computation.signals.riskCount,
      overall_score: computation.overallScore,
      recommended_use_case: computation.recommendedUseCase,
      priority_band: computation.priorityBand,
    },
  });

  loggers.api.info('Agreement analyzer lead scored', {
    leadId,
    reportId: input.reportId,
    scoreId: scoreRecord.id,
    structuralFitScore: computation.structuralFitScore,
    engagementBonus: computation.engagementBonus,
    overallScore: computation.overallScore,
    priorityBand: computation.priorityBand,
    recommendedUseCase: computation.recommendedUseCase,
  });

  const attribution = await getLeadAttributionAnalyticsProperties(leadId);

  trackAgreementAnalyzerEvent('agreement_analyzer_lead_scored', {
    leadId,
    reportId: input.reportId,
    structuralFitScore: computation.structuralFitScore,
    engagementBonus: computation.engagementBonus,
    overallScore: computation.overallScore,
    priorityBand: computation.priorityBand,
    recommendedUseCase: computation.recommendedUseCase,
    settlementComplexityScore: computation.settlementComplexityScore,
    ...attribution,
  });

  return {
    ...computation,
    leadId,
    scoreId: scoreRecord.id,
  };
}

export function scheduleLeadScoreCalculation(reportId: string): void {
  void calculateLeadScore({ reportId }).catch((error) => {
    loggers.api.error('Background lead score calculation failed', error, { reportId });
  });
}
