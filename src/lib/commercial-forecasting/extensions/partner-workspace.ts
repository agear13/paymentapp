/**
 * Partner workspace extension points.
 *
 * Forecasting supports single merchant, portfolio, advisor, and bookkeeper
 * views without redesign — aggregate at the workspace level.
 */

import type {
  CommercialForecastingInput,
  CommercialForecastingResult,
} from '@/lib/commercial-forecasting/types';
import { deriveCommercialForecasting } from '@/lib/commercial-forecasting/derive-commercial-forecast';

export type PartnerWorkspaceScope = 'single_merchant' | 'portfolio' | 'advisor' | 'bookkeeper';

export type PartnerForecastSlice = {
  scope: PartnerWorkspaceScope;
  projectId: string | null;
  dealId: string | null;
  forecast: CommercialForecastingResult;
};

export type PortfolioForecastResult = {
  scope: 'portfolio';
  merchantCount: number;
  aggregatedRevenue: number;
  aggregatedCosts: number;
  aggregatedCashBalance: number;
  currency: string;
  slices: PartnerForecastSlice[];
  upcomingEvents: CommercialForecastingResult['events'];
};

/** Derive forecast for a single merchant workspace. */
export function deriveMerchantForecast(
  input: CommercialForecastingInput
): PartnerForecastSlice {
  return {
    scope: 'single_merchant',
    projectId: input.projectId ?? null,
    dealId: input.dealId ?? null,
    forecast: deriveCommercialForecasting(input),
  };
}

/** Aggregate forecasts across a portfolio of merchants. */
export function derivePortfolioForecast(
  inputs: CommercialForecastingInput[]
): PortfolioForecastResult {
  const slices = inputs.map((input) => deriveMerchantForecast(input));
  const currency = inputs[0]?.currency ?? 'AUD';

  let aggregatedRevenue = 0;
  let aggregatedCosts = 0;
  let aggregatedCashBalance = 0;
  const upcomingEvents: CommercialForecastingResult['events'] = [];

  for (const slice of slices) {
    aggregatedRevenue += slice.forecast.revenue.totalForecastRevenue;
    aggregatedCosts += slice.forecast.costs.totalForecastCosts;
    aggregatedCashBalance += slice.forecast.cashflow.expectedCashBalance;
    upcomingEvents.push(...slice.forecast.events.filter((e) => !e.occurred));
  }

  upcomingEvents.sort((a, b) => a.date.localeCompare(b.date));

  return {
    scope: 'portfolio',
    merchantCount: inputs.length,
    aggregatedRevenue,
    aggregatedCosts,
    aggregatedCashBalance,
    currency,
    slices,
    upcomingEvents,
  };
}

/** Advisor view — portfolio with risk emphasis. */
export function deriveAdvisorForecast(
  inputs: CommercialForecastingInput[]
): PortfolioForecastResult & { highRiskCount: number } {
  const portfolio = derivePortfolioForecast(inputs);
  const highRiskCount = portfolio.slices.reduce(
    (count, s) => count + s.forecast.risks.filter((r) => r.severity === 'high').length,
    0
  );
  return { ...portfolio, highRiskCount };
}

/** Bookkeeper view — receivables and payables emphasis. */
export function deriveBookkeeperForecast(
  input: CommercialForecastingInput
): PartnerForecastSlice & {
  accountsReceivable: number;
  accountsPayable: number;
} {
  const slice = deriveMerchantForecast(input);
  return {
    ...slice,
    accountsReceivable: slice.forecast.workingCapital.accountsReceivable,
    accountsPayable: slice.forecast.workingCapital.accountsPayable,
  };
}
