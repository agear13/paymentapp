/**
 * Profit forecast — gross profit, net profit, and margins from commercial data.
 */

import type {
  CommercialForecastingInput,
  ProfitForecast,
  CostForecast,
  RevenueForecast,
} from '@/lib/commercial-forecasting/types';
import { deriveRevenueForecast } from '@/lib/commercial-forecasting/derive-revenue-forecast';
import { deriveCostForecast } from '@/lib/commercial-forecasting/derive-cost-forecast';
import type { CommercialForecastResult } from '@/lib/commercial/commercial-forecast';

/** Derive profit forecast from revenue and cost forecasts. */
export function deriveProfitForecast(
  input: CommercialForecastingInput,
  revenue?: RevenueForecast,
  costs?: CostForecast,
  dollarForecast?: CommercialForecastResult
): ProfitForecast {
  const rev = revenue ?? deriveRevenueForecast(input, dollarForecast);
  const cost = costs ?? deriveCostForecast(input);

  const grossProfit = rev.totalForecastRevenue - cost.participantPayouts;
  const netProfit = rev.totalForecastRevenue - cost.totalForecastCosts;
  const contributionMargin =
    rev.totalForecastRevenue > 0
      ? (grossProfit / rev.totalForecastRevenue) * 100
      : 0;
  const futureMargin =
    rev.expectedRevenue > 0
      ? ((rev.expectedRevenue - cost.futureObligations) / rev.expectedRevenue) * 100
      : 0;

  return {
    grossProfit,
    netProfit,
    contributionMargin,
    futureMargin,
    currency: input.currency,
  };
}
