/**
 * AI extension points — future AI consumes forecasting, does not recreate it.
 *
 * Do not implement AI here. Only typed extension contracts.
 */

import type {
  CommercialForecastingInput,
  CommercialForecastingResult,
} from '@/lib/commercial-forecasting/types';
import { deriveCommercialForecasting } from '@/lib/commercial-forecasting/derive-commercial-forecast';

export type AiForecastRecommendation = {
  id: string;
  category: 'cashflow_warning' | 'revenue_projection' | 'settlement_prediction' | 'working_capital_advice';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  relatedEventIds: string[];
};

export type AiForecastExtensionResult = {
  status: 'extension_point';
  recommendations: AiForecastRecommendation[];
  forecastSnapshot: CommercialForecastingResult;
  message: string;
};

/** Extension point: cashflow warnings for future AI copilot. */
export function deriveAiCashflowWarningsExtension(
  input: CommercialForecastingInput
): AiForecastExtensionResult {
  const forecast = deriveCommercialForecasting(input);
  const recommendations: AiForecastRecommendation[] = [];

  if (forecast.cashflow.expectedCashBalance < 0) {
    recommendations.push({
      id: 'cashflow_deficit',
      category: 'cashflow_warning',
      title: 'Cashflow deficit forecast',
      message: `Expected cash balance is negative (${forecast.cashflow.expectedCashBalance} ${forecast.currency})`,
      severity: 'critical',
      relatedEventIds: forecast.events.map((e) => e.id),
    });
  }

  if (forecast.cashflow.outstandingReceivables > forecast.cashflow.outstandingPayables) {
    recommendations.push({
      id: 'receivables_exceed_payables',
      category: 'working_capital_advice',
      title: 'Receivables exceed payables',
      message: 'Outstanding receivables exceed payables — monitor customer payment timing',
      severity: 'info',
      relatedEventIds: [],
    });
  }

  return {
    status: 'extension_point',
    recommendations,
    forecastSnapshot: forecast,
    message: 'AI cashflow warnings will consume this extension when implemented.',
  };
}

/** Extension point: revenue projections for future AI. */
export function deriveAiRevenueProjectionExtension(
  input: CommercialForecastingInput
): AiForecastExtensionResult {
  const forecast = deriveCommercialForecasting(input);
  return {
    status: 'extension_point',
    recommendations: [
      {
        id: 'revenue_projection',
        category: 'revenue_projection',
        title: 'Revenue projection available',
        message: `Total forecast revenue: ${forecast.revenue.totalForecastRevenue} ${forecast.currency}`,
        severity: 'info',
        relatedEventIds: forecast.events
          .filter((e) => e.category === 'customer_payment_expected')
          .map((e) => e.id),
      },
    ],
    forecastSnapshot: forecast,
    message: 'AI revenue projections will consume this extension when implemented.',
  };
}

/** Extension point: settlement predictions for future AI. */
export function deriveAiSettlementPredictionExtension(
  input: CommercialForecastingInput
): AiForecastExtensionResult {
  const forecast = deriveCommercialForecasting(input);
  const settlementEvents = forecast.events.filter(
    (e) => e.category === 'participant_settlement'
  );

  return {
    status: 'extension_point',
    recommendations: settlementEvents.map((e) => ({
      id: `settlement_pred:${e.id}`,
      category: 'settlement_prediction' as const,
      title: `Settlement expected: ${e.description}`,
      message: `${e.date} — ${e.amount ?? 'TBD'} ${e.currency}`,
      severity: 'info' as const,
      relatedEventIds: [e.id],
    })),
    forecastSnapshot: forecast,
    message: 'AI settlement predictions will consume this extension when implemented.',
  };
}
