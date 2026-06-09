import 'server-only';

import type { ObligationReportLeadLifecycleStage } from '@prisma/client';

import { trackAgreementAnalyzerEvent } from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server';
import { getLeadAttributionAnalyticsProperties } from '@/lib/agreement-analyzer/attribution/lead-attribution.server';
import { prisma } from '@/lib/server/prisma';

export async function transitionLeadLifecycleStage(input: {
  leadId: string;
  fromStages: ObligationReportLeadLifecycleStage[];
  toStage: ObligationReportLeadLifecycleStage;
}): Promise<boolean> {
  const updated = await prisma.obligation_report_leads.updateMany({
    where: {
      id: input.leadId,
      lifecycle_stage: { in: input.fromStages },
    },
    data: { lifecycle_stage: input.toStage },
  });

  return updated.count > 0;
}

/**
 * Placeholder for future Calendly (or similar) demo booking webhooks.
 * Call when a lead books a demo from the report email or report page.
 */
const DEMO_BOOKED_FROM_STAGES: ObligationReportLeadLifecycleStage[] = [
  'REPORT_GENERATED',
  'REPORT_VIEWED',
  'QUALIFIED',
];

export async function markLeadDemoBooked(leadId: string, _source = 'manual'): Promise<boolean> {
  return markLeadDemoBookedFromCalendly(leadId);
}

export async function markLeadDemoBookedFromCalendly(leadId: string): Promise<boolean> {
  const updated = await prisma.obligation_report_leads.updateMany({
    where: {
      id: leadId,
      lifecycle_stage: { in: DEMO_BOOKED_FROM_STAGES },
    },
    data: { lifecycle_stage: 'DEMO_BOOKED' },
  });

  return updated.count > 0;
}

export type RecordDemoBookingInput = {
  leadId: string;
  source: string;
  bookedAt?: Date;
  externalReference?: string | null;
};

/**
 * Service-layer placeholder for future demo booking integrations.
 * Persists lifecycle only; external booking metadata can be added when webhooks land.
 */
export async function recordDemoBookingIntent(
  input: RecordDemoBookingInput
): Promise<{ transitioned: boolean }> {
  const transitioned = await markLeadDemoBooked(input.leadId, input.source);
  return { transitioned };
}

export async function markLeadQualified(leadId: string): Promise<boolean> {
  return transitionLeadLifecycleStage({
    leadId,
    fromStages: ['REPORT_GENERATED', 'REPORT_VIEWED', 'DEMO_BOOKED'],
    toStage: 'QUALIFIED',
  });
}

export async function markLeadCustomer(leadId: string): Promise<boolean> {
  const transitioned = await transitionLeadLifecycleStage({
    leadId,
    fromStages: ['QUALIFIED', 'DEMO_BOOKED'],
    toStage: 'CUSTOMER',
  });

  if (transitioned) {
    const attribution = await getLeadAttributionAnalyticsProperties(leadId);
    trackAgreementAnalyzerEvent('agreement_analyzer_customer', {
      leadId,
      ...attribution,
    });
  }

  return transitioned;
}

export type AgreementAnalyzerLifecycleAction = 'QUALIFIED' | 'DEMO_BOOKED' | 'CUSTOMER';

export async function updateAgreementAnalyzerLeadLifecycle(
  leadId: string,
  action: AgreementAnalyzerLifecycleAction
): Promise<boolean> {
  switch (action) {
    case 'QUALIFIED':
      return markLeadQualified(leadId);
    case 'DEMO_BOOKED':
      return markLeadDemoBooked(leadId, 'dashboard');
    case 'CUSTOMER':
      return markLeadCustomer(leadId);
    default:
      return false;
  }
}
