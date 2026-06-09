import 'server-only';

import {
  attributionToAnalyticsProperties,
  normalizeAgreementAnalyzerAttribution,
} from '@/lib/agreement-analyzer/attribution/agreement-analyzer-attribution';
import type { AgreementAnalyzerAttributionInput } from '@/lib/agreement-analyzer/attribution/agreement-analyzer-attribution-types';
import type { AgreementAnalyzerAnalyticsProperties } from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics-types';
import { prisma } from '@/lib/server/prisma';

const LEAD_ATTRIBUTION_SELECT = {
  utm_source: true,
  utm_medium: true,
  utm_campaign: true,
  utm_content: true,
  utm_term: true,
  referrer: true,
  landing_page: true,
  first_touch_at: true,
} as const;

export function buildLeadAttributionCreateData(
  input: AgreementAnalyzerAttributionInput | null | undefined
) {
  if (!input) return {};

  const normalized = normalizeAgreementAnalyzerAttribution(input);

  return {
    utm_source: normalized.utm_source,
    utm_medium: normalized.utm_medium,
    utm_campaign: normalized.utm_campaign,
    utm_content: normalized.utm_content,
    utm_term: normalized.utm_term,
    referrer: normalized.referrer,
    landing_page: normalized.landing_page,
    first_touch_at: normalized.first_touch_at ? new Date(normalized.first_touch_at) : new Date(),
  };
}

export async function getLeadAttributionAnalyticsProperties(
  leadId: string
): Promise<AgreementAnalyzerAnalyticsProperties> {
  const lead = await prisma.obligation_report_leads.findUnique({
    where: { id: leadId },
    select: LEAD_ATTRIBUTION_SELECT,
  });

  if (!lead) return {};

  return attributionToAnalyticsProperties({
    ...lead,
    first_touch_at: lead.first_touch_at?.toISOString() ?? null,
  });
}
