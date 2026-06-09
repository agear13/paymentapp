import 'server-only';

import { parseCalendlyTrackingToken } from '@/lib/agreement-analyzer/calendly/calendly-attribution.server';
import type { AgreementAnalyzerAttributionBreakdown } from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-types';
import { prisma } from '@/lib/server/prisma';

function buildPercentageBreakdown(
  counts: Map<string, number>,
  total: number
): AgreementAnalyzerAttributionBreakdown[] {
  if (total === 0) return [];

  return [...counts.entries()]
    .map(([label, count]) => ({
      label,
      count,
      percentage: Number(((count / total) * 100).toFixed(1)),
    }))
    .sort((left, right) => right.count - left.count);
}

export async function getAgreementAnalyzerAttributionAnalytics(): Promise<{
  topConvertingUseCases: AgreementAnalyzerAttributionBreakdown[];
  topConvertingBusinessTypes: AgreementAnalyzerAttributionBreakdown[];
  topConvertingPriorityBands: AgreementAnalyzerAttributionBreakdown[];
}> {
  const bookings = await prisma.agreement_analyzer_demo_bookings.findMany({
    select: {
      tracking_token: true,
      lead: {
        select: {
          business_type: true,
        },
      },
    },
  });

  const useCaseCounts = new Map<string, number>();
  const businessTypeCounts = new Map<string, number>();
  const priorityBandCounts = new Map<string, number>();

  for (const booking of bookings) {
    const attribution = parseCalendlyTrackingToken(booking.tracking_token);

    const useCase = attribution?.recommendedUseCase ?? 'Unknown';
    const priorityBand = attribution?.priorityBand ?? 'Unknown';
    const businessType = booking.lead.business_type ?? 'Unknown';

    useCaseCounts.set(useCase, (useCaseCounts.get(useCase) ?? 0) + 1);
    businessTypeCounts.set(businessType, (businessTypeCounts.get(businessType) ?? 0) + 1);
    priorityBandCounts.set(priorityBand, (priorityBandCounts.get(priorityBand) ?? 0) + 1);
  }

  const total = bookings.length;

  return {
    topConvertingUseCases: buildPercentageBreakdown(useCaseCounts, total),
    topConvertingBusinessTypes: buildPercentageBreakdown(businessTypeCounts, total),
    topConvertingPriorityBands: buildPercentageBreakdown(priorityBandCounts, total),
  };
}
