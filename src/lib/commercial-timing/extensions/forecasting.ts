/**
 * Forecasting extension points — delegates to commercial-forecasting domain.
 *
 * Commercial timing is a primary input driver for forecasting.
 */

import type { CommercialTimingForecastInput } from '@/lib/commercial-timing/types';
import {
  deriveCommercialForecasting,
  type CommercialForecastingInput,
} from '@/lib/commercial-forecasting';
import type { RevenueForecast } from '@/lib/commercial-forecasting/types';
import type { CashflowForecast } from '@/lib/commercial-forecasting/types';

export type ExpectedRevenueTimingResult = {
  expectedPaymentDate: string | null;
  expectedSettlementDate: string | null;
  recognitionPeriod: CommercialTimingForecastInput['resolved']['recognitionPeriod'];
  revenue: RevenueForecast | null;
};

export type CashFlowForecastResult = {
  inflows: CashflowForecast['periods'];
  outflows: CashflowForecast['periods'];
  cashflow: CashflowForecast;
};

/** Derive expected revenue timing from commercial timing. */
export function deriveExpectedRevenueTiming(
  input: CommercialTimingForecastInput,
  forecastingInput?: Partial<CommercialForecastingInput>
): ExpectedRevenueTimingResult {
  const { resolved } = input;
  const baseInput: CommercialForecastingInput = {
    currency: forecastingInput?.currency ?? 'AUD',
    agreementTiming: input.agreementTiming,
    fundingSources: forecastingInput?.fundingSources ?? [],
    treasury: forecastingInput?.treasury ?? null,
    obligationRows: forecastingInput?.obligationRows ?? [],
    releaseConfidence: forecastingInput?.releaseConfidence ?? null,
    ...forecastingInput,
  };

  const forecast = deriveCommercialForecasting(baseInput);

  return {
    expectedPaymentDate: resolved.expectedPaymentDate ?? null,
    expectedSettlementDate: resolved.expectedSettlementDate ?? null,
    recognitionPeriod: resolved.recognitionPeriod ?? null,
    revenue: forecast.revenue,
  };
}

/** Derive cash flow forecast from commercial timing and commitments. */
export function deriveCashFlowForecast(
  input: CommercialTimingForecastInput,
  forecastingInput?: Partial<CommercialForecastingInput>
): CashFlowForecastResult {
  const baseInput: CommercialForecastingInput = {
    currency: forecastingInput?.currency ?? 'AUD',
    agreementTiming: input.agreementTiming,
    fundingSources: forecastingInput?.fundingSources ?? [],
    treasury: forecastingInput?.treasury ?? null,
    obligationRows: forecastingInput?.obligationRows ?? [],
    releaseConfidence: forecastingInput?.releaseConfidence ?? null,
    ...forecastingInput,
  };

  const forecast = deriveCommercialForecasting(baseInput);

  return {
    inflows: forecast.cashflow.periods,
    outflows: forecast.cashflow.periods,
    cashflow: forecast.cashflow,
  };
}

/** Derive profit forecast from commercial timing and obligations. */
export function deriveProfitForecast(
  input: CommercialTimingForecastInput,
  forecastingInput?: Partial<CommercialForecastingInput>
) {
  const baseInput: CommercialForecastingInput = {
    currency: forecastingInput?.currency ?? 'AUD',
    agreementTiming: input.agreementTiming,
    fundingSources: forecastingInput?.fundingSources ?? [],
    treasury: forecastingInput?.treasury ?? null,
    obligationRows: forecastingInput?.obligationRows ?? [],
    releaseConfidence: forecastingInput?.releaseConfidence ?? null,
    ...forecastingInput,
  };

  return deriveCommercialForecasting(baseInput).profit;
}
