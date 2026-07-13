/**
 * Forecasting report derivation — reusable services for future dashboards.
 *
 * No UI. Only report slices consumed by merchant, bookkeeper, partner views.
 */

import type {
  CommercialForecastingInput,
  CommercialForecastingResult,
} from '@/lib/commercial-forecasting/types';
import { deriveCommercialForecasting } from '@/lib/commercial-forecasting/derive-commercial-forecast';

export type ForecastReportSlice = {
  reportId: string;
  title: string;
  summary: string;
  currency: string;
  generatedAt: string;
  data: Record<string, unknown>;
};

function reportBase(title: string, currency: string): Omit<ForecastReportSlice, 'data'> {
  return {
    reportId: title.toLowerCase().replace(/\s+/g, '_'),
    title,
    summary: '',
    currency,
    generatedAt: new Date().toISOString(),
  };
}

/** Revenue forecast report slice. */
export function deriveRevenueForecastReport(
  input: CommercialForecastingInput
): ForecastReportSlice {
  const forecast = deriveCommercialForecasting(input);
  return {
    ...reportBase('Revenue Forecast', input.currency),
    summary: `Total forecast revenue: ${forecast.revenue.totalForecastRevenue} ${input.currency}`,
    data: {
      committed: forecast.revenue.committedRevenue,
      pending: forecast.revenue.pendingRevenue,
      expected: forecast.revenue.expectedRevenue,
      recognised: forecast.revenue.recognisedRevenue,
      collected: forecast.revenue.collectedRevenue,
      total: forecast.revenue.totalForecastRevenue,
      byPeriod: forecast.revenue.byPeriod,
    },
  };
}

/** Cashflow forecast report slice. */
export function deriveCashflowForecastReport(
  input: CommercialForecastingInput
): ForecastReportSlice {
  const forecast = deriveCommercialForecasting(input);
  return {
    ...reportBase('Cashflow Forecast', input.currency),
    summary: `Expected cash balance: ${forecast.cashflow.expectedCashBalance} ${input.currency}`,
    data: {
      customerPayments: forecast.cashflow.expectedCustomerPayments,
      participantSettlements: forecast.cashflow.expectedParticipantSettlements,
      bankDeposits: forecast.cashflow.expectedBankDeposits,
      expectedCashBalance: forecast.cashflow.expectedCashBalance,
      outstandingReceivables: forecast.cashflow.outstandingReceivables,
      outstandingPayables: forecast.cashflow.outstandingPayables,
      periods: forecast.cashflow.periods,
    },
  };
}

/** Settlement forecast report slice. */
export function deriveSettlementForecastReport(
  input: CommercialForecastingInput
): ForecastReportSlice {
  const forecast = deriveCommercialForecasting(input);
  const settlementEvents = forecast.events.filter(
    (e) => e.category === 'participant_settlement' || e.category === 'settlement_eligible'
  );
  return {
    ...reportBase('Settlement Forecast', input.currency),
    summary: `${settlementEvents.length} settlement event(s) forecast`,
    data: {
      outstandingSettlement: forecast.workingCapital.outstandingSettlement,
      settlementEvents,
      settlementEligible: forecast.dollarForecast.cashReadiness.canEveryoneBePaid,
    },
  };
}

/** Profit forecast report slice. */
export function deriveProfitForecastReport(
  input: CommercialForecastingInput
): ForecastReportSlice {
  const forecast = deriveCommercialForecasting(input);
  return {
    ...reportBase('Profit Forecast', input.currency),
    summary: `Net profit forecast: ${forecast.profit.netProfit} ${input.currency}`,
    data: {
      grossProfit: forecast.profit.grossProfit,
      netProfit: forecast.profit.netProfit,
      contributionMargin: forecast.profit.contributionMargin,
      futureMargin: forecast.profit.futureMargin,
    },
  };
}

/** Working capital forecast report slice. */
export function deriveWorkingCapitalForecastReport(
  input: CommercialForecastingInput
): ForecastReportSlice {
  const forecast = deriveCommercialForecasting(input);
  return {
    ...reportBase('Working Capital Forecast', input.currency),
    summary: `Expected cash: ${forecast.workingCapital.expectedCash} ${input.currency}`,
    data: {
      accountsReceivable: forecast.workingCapital.accountsReceivable,
      accountsPayable: forecast.workingCapital.accountsPayable,
      expectedCash: forecast.workingCapital.expectedCash,
      outstandingSettlement: forecast.workingCapital.outstandingSettlement,
      futureCommitments: forecast.workingCapital.futureCommitments,
    },
  };
}

/** Derive all forecast reports in one call. */
export function deriveAllForecastReports(
  input: CommercialForecastingInput
): ForecastReportSlice[] {
  return [
    deriveRevenueForecastReport(input),
    deriveCashflowForecastReport(input),
    deriveSettlementForecastReport(input),
    deriveProfitForecastReport(input),
    deriveWorkingCapitalForecastReport(input),
  ];
}

/** Forecast events report — what happens next. */
export function deriveForecastEventsReport(
  input: CommercialForecastingInput
): ForecastReportSlice {
  const forecast = deriveCommercialForecasting(input);
  const upcoming = forecast.events.filter((e) => !e.occurred);
  return {
    ...reportBase('Forecast Events', input.currency),
    summary: `${upcoming.length} upcoming commercial event(s)`,
    data: {
      upcoming,
      all: forecast.events,
      timeline: forecast.timeline,
    },
  };
}

export type { CommercialForecastingResult };
