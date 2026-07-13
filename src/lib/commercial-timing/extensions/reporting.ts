/**
 * Reporting extension points.
 *
 * Future reports will group by recognition period, service period, and
 * expected settlement/payment dates using commercial timing — not invoice dates alone.
 */

import type {
  CommercialTimingReportingDimensions,
  ResolvedCommercialTiming,
} from '@/lib/commercial-timing/types';
import { formatYearMonth } from '@/lib/commercial-timing/serialization';

export type ReportingSlicePlaceholder = {
  status: 'not_implemented';
  dimensions: CommercialTimingReportingDimensions;
  groupKey: string | null;
  message: string;
};

/** Derive reporting dimensions from resolved commercial timing. */
export function deriveReportingDimensions(
  timing: ResolvedCommercialTiming
): CommercialTimingReportingDimensions {
  return {
    recognitionPeriod: timing.recognitionPeriod ?? null,
    servicePeriodStart: timing.servicePeriodStart ?? null,
    servicePeriodEnd: timing.servicePeriodEnd ?? null,
    expectedPaymentDate: timing.expectedPaymentDate ?? null,
    expectedSettlementDate: timing.expectedSettlementDate ?? null,
  };
}

/** Group key for revenue/cost by recognition period reports. */
export function recognitionPeriodGroupKey(
  timing: ResolvedCommercialTiming
): string | null {
  if (!timing.recognitionPeriod) return null;
  return formatYearMonth(timing.recognitionPeriod);
}

/** Placeholder for revenue by recognition period report. */
export function deriveRevenueByRecognitionPeriod(
  timing: ResolvedCommercialTiming,
  amount: number
): ReportingSlicePlaceholder {
  const dimensions = deriveReportingDimensions(timing);
  return {
    status: 'not_implemented',
    dimensions,
    groupKey: recognitionPeriodGroupKey(timing),
    message: `Revenue ${amount} will report under recognition period ${dimensions.recognitionPeriod ? formatYearMonth(dimensions.recognitionPeriod) : 'unset'} when dashboards are implemented.`,
  };
}

/** Placeholder for costs by recognition period report. */
export function deriveCostsByRecognitionPeriod(
  timing: ResolvedCommercialTiming,
  amount: number
): ReportingSlicePlaceholder {
  return deriveRevenueByRecognitionPeriod(timing, amount);
}

/** Placeholder for expected settlement report. */
export function deriveExpectedSettlementReport(
  timing: ResolvedCommercialTiming
): ReportingSlicePlaceholder {
  const dimensions = deriveReportingDimensions(timing);
  return {
    status: 'not_implemented',
    dimensions,
    groupKey: dimensions.expectedSettlementDate,
    message: 'Expected settlement report will use commercial timing when dashboards are implemented.',
  };
}
