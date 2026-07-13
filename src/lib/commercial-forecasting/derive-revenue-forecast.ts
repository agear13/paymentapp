/**
 * Revenue forecast — committed, pending, expected, recognised, and collected.
 *
 * Consumes deriveCommercialForecast() for dollar totals — never duplicates math.
 */

import type {
  CommercialForecastingInput,
  RevenueForecast,
  RevenuePeriodSlice,
} from '@/lib/commercial-forecasting/types';
import { CommercialForecastConfidence } from '@/lib/commercial-forecasting/types';
import {
  deriveCommercialForecast,
  type CommercialForecastResult,
} from '@/lib/commercial/commercial-forecast';
import { resolveCommercialTiming } from '@/lib/commercial-timing/resolve-commercial-timing';
import type { YearMonth } from '@/lib/commercial-timing/types';
import { isFundingConfirmed } from '@/lib/projects/funding-sources/funding-source-status';
import { confidenceFromFundingSource } from '@/lib/commercial-forecasting/derive-forecast-confidence';

function periodFromDate(iso: string | null | undefined): YearMonth | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function periodKey(p: YearMonth): string {
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
}

function deriveRecognisedRevenue(
  input: CommercialForecastingInput,
  dollarForecast: CommercialForecastResult
): number {
  const timing = resolveCommercialTiming({
    agreementDefaults: input.agreementTiming ?? null,
    documentTiming: null,
  });

  if (!timing.recognitionPeriod) {
    return dollarForecast.confirmedRevenue;
  }

  const asOf = input.asOfDate ? new Date(input.asOfDate) : new Date();
  const { year, month } = timing.recognitionPeriod;
  const recognitionStart = new Date(year, month - 1, 1);

  if (asOf >= recognitionStart) {
    return dollarForecast.confirmedRevenue + dollarForecast.pendingRevenue;
  }

  return 0;
}

function deriveRevenueByPeriod(
  input: CommercialForecastingInput
): RevenuePeriodSlice[] {
  const periodMap = new Map<string, RevenuePeriodSlice>();

  for (const source of input.fundingSources) {
    const period =
      periodFromDate(source.expectedSettlementDate) ??
      periodFromDate(input.agreementTiming?.recognitionPeriod
        ? `${input.agreementTiming.recognitionPeriod.year}-${String(input.agreementTiming.recognitionPeriod.month).padStart(2, '0')}-01`
        : null);

    if (!period) continue;

    const key = periodKey(period);
    const existing = periodMap.get(key) ?? {
      period,
      expectedAmount: 0,
      recognisedAmount: 0,
      confidence: CommercialForecastConfidence.Expected,
    };

    existing.expectedAmount += source.amount;
    if (isFundingConfirmed(source.status)) {
      existing.recognisedAmount += source.amount;
      existing.confidence = CommercialForecastConfidence.Committed;
    } else {
      const { confidence } = confidenceFromFundingSource(source);
      if (
        confidence === CommercialForecastConfidence.Tentative &&
        existing.confidence !== CommercialForecastConfidence.Tentative
      ) {
        // keep higher confidence
      } else if (confidence !== CommercialForecastConfidence.Committed) {
        existing.confidence = confidence;
      }
    }

    periodMap.set(key, existing);
  }

  return [...periodMap.values()].sort(
    (a, b) => periodKey(a.period).localeCompare(periodKey(b.period))
  );
}

/** Derive revenue forecast from commercial commitments. */
export function deriveRevenueForecast(
  input: CommercialForecastingInput,
  dollarForecast?: CommercialForecastResult
): RevenueForecast {
  const forecast =
    dollarForecast ??
    deriveCommercialForecast({
      fundingSources: input.fundingSources,
      treasury: input.treasury,
      obligationRows: input.obligationRows,
      releaseConfidence: input.releaseConfidence,
      currency: input.currency,
    });

  const recognisedRevenue = deriveRecognisedRevenue(input, forecast);

  return {
    committedRevenue: forecast.confirmedRevenue,
    pendingRevenue: forecast.pendingRevenue,
    expectedRevenue: forecast.forecastRevenue,
    recognisedRevenue,
    collectedRevenue: forecast.confirmedRevenue,
    totalForecastRevenue: forecast.totalExpectedRevenue,
    currency: input.currency,
    byPeriod: deriveRevenueByPeriod(input),
  };
}
