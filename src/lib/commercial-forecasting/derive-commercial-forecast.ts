/**
 * Canonical Commercial Forecasting Engine.
 *
 * Single source of truth for all forecasting — dashboards, AI, reports, and
 * partner workspaces consume this. Does not duplicate dollar forecast math;
 * delegates to deriveCommercialForecast() for totals.
 *
 * Provvypay forecasts from commercial commitments, not historical accounting.
 */

import {
  deriveCommercialForecast,
  type CommercialForecastInput,
} from '@/lib/commercial/commercial-forecast';
import { deriveForecastEvents } from '@/lib/commercial-forecasting/derive-forecast-events';
import { deriveRevenueForecast } from '@/lib/commercial-forecasting/derive-revenue-forecast';
import { deriveCostForecast } from '@/lib/commercial-forecasting/derive-cost-forecast';
import { deriveCashflowForecast } from '@/lib/commercial-forecasting/derive-cashflow-forecast';
import { deriveProfitForecast } from '@/lib/commercial-forecasting/derive-profit-forecast';
import { deriveWorkingCapital } from '@/lib/commercial-forecasting/derive-working-capital';
import { deriveRiskAnalysis } from '@/lib/commercial-forecasting/derive-risk-analysis';
import { buildForecastTimeline } from '@/lib/commercial-forecasting/forecast-timeline';
import {
  deriveOverallForecastConfidence,
  confidenceFromFundingSource,
} from '@/lib/commercial-forecasting/derive-forecast-confidence';
import type {
  CommercialForecastingInput,
  CommercialForecastingResult,
} from '@/lib/commercial-forecasting/types';

/**
 * Derive the complete commercial forecasting view.
 *
 * Consumes: commercial timing, funding sources, obligations, invoice lifecycle,
 * settlement workflow, and release confidence — never historical accounting.
 */
export function deriveCommercialForecasting(
  input: CommercialForecastingInput
): CommercialForecastingResult {
  const forecastInput: CommercialForecastInput = {
    fundingSources: input.fundingSources,
    treasury: input.treasury,
    obligationRows: input.obligationRows,
    releaseConfidence: input.releaseConfidence,
    currency: input.currency,
  };

  const dollarForecast = deriveCommercialForecast(forecastInput);
  const events = deriveForecastEvents(input);
  const revenue = deriveRevenueForecast(input, dollarForecast);
  const costs = deriveCostForecast(input);
  const cashflow = deriveCashflowForecast(input, events);
  const profit = deriveProfitForecast(input, revenue, costs, dollarForecast);
  const workingCapital = deriveWorkingCapital(input, cashflow, dollarForecast);
  const risks = deriveRiskAnalysis(input, dollarForecast);
  const timeline = buildForecastTimeline(input, events);

  const confidenceSignals = input.fundingSources.map(
    (s) => confidenceFromFundingSource(s).confidence
  );
  const { confidence: overallConfidence, reasons: overallConfidenceReasons } =
    deriveOverallForecastConfidence(confidenceSignals);

  return {
    dollarForecast,
    revenue,
    costs,
    cashflow,
    profit,
    workingCapital,
    events,
    timeline,
    risks,
    currency: input.currency,
    projectId: input.projectId ?? null,
    dealId: input.dealId ?? null,
    overallConfidence,
    overallConfidenceReasons,
  };
}

/** Build forecasting input from commercial financial snapshot inputs. */
export function commercialForecastingInputFromSnapshot(
  input: CommercialForecastingInput
): CommercialForecastingInput {
  return input;
}
