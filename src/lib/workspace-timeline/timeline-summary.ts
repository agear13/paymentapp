import type { BusinessFinancialSnapshot } from '@/lib/commercial/business-financial-snapshot';
import { deriveCommercialForecasting } from '@/lib/commercial-forecasting/derive-commercial-forecast';
import { buildPortfolioForecastingInput } from '@/lib/workspace-timeline/build-portfolio-forecasting-input';
import { mapForecastEventsToCashFlowPoints } from '@/lib/workspace-timeline/map-forecast-cashflow-points';
import type {
  CashFlowForecastPoint,
  TimelineMonthSummary,
  WorkspaceTimelineEvent,
  WorkspaceTimelineInput,
} from '@/lib/workspace-timeline/types';
import { eventsInMonth } from '@/lib/workspace-timeline/timeline-filters';

export function deriveTimelineMonthSummary(
  input: WorkspaceTimelineInput,
  events: WorkspaceTimelineEvent[],
  month: Date
): TimelineMonthSummary {
  const business = input.business;
  const forecast = business?.commercial.forecast;
  const currency = business?.currency ?? 'AUD';
  const monthEvents = eventsInMonth(events, month);

  let monthIncoming = 0;
  let monthOutgoing = 0;
  for (const e of monthEvents) {
    if (e.amount == null) continue;
    if (e.direction === 'incoming') monthIncoming += e.amount;
    if (e.direction === 'outgoing') monthOutgoing += e.amount;
  }

  const health = business?.projectHealth;

  return {
    incomingExpected: forecast?.totalExpectedRevenue ?? monthIncoming,
    incomingConfirmed: forecast?.confirmedRevenue ?? 0,
    outgoing: forecast?.totalCommitments ?? monthOutgoing,
    forecastSurplus: forecast?.forecastPosition.forecastSurplus ?? monthIncoming - monthOutgoing,
    currency,
    activeProjects: business?.activeProjects ?? input.deals.length,
    projectsAtRisk: (health?.atRisk ?? 0) + (health?.blocked ?? 0),
    settlementsWaiting: monthEvents.filter(
      (e) => e.type === 'settlement_pending' || e.status === 'settlement_pending'
    ).length,
    approvalsWaiting: input.participants.filter((p) =>
      p.approvalStatus?.toLowerCase().includes('pending')
    ).length,
  };
}

function fallbackCashFlowPoint(
  business: BusinessFinancialSnapshot | null,
  month: Date
): CashFlowForecastPoint[] {
  const currency = business?.currency ?? 'AUD';
  const startingBalance =
    business?.commercial.forecast.forecastPosition.forecastBalance ?? 0;

  return [
    {
      date: month.toISOString().slice(0, 10),
      balance: startingBalance,
      currency,
      isDeficit: startingBalance < 0,
    },
  ];
}

/** Cashflow forecast for the calendar — consumes the Commercial Forecasting Engine. */
export function deriveCashFlowForecast(
  input: WorkspaceTimelineInput,
  month: Date
): CashFlowForecastPoint[] {
  const forecastingInput = buildPortfolioForecastingInput(input);
  if (!forecastingInput) {
    return fallbackCashFlowPoint(input.business, month);
  }

  const forecast = deriveCommercialForecasting(forecastingInput);
  const openingBalance =
    input.business?.commercial.forecast.forecastPosition.forecastBalance ??
    forecast.cashflow.periods[0]?.openingBalance ??
    0;

  return mapForecastEventsToCashFlowPoints(
    forecast.events,
    openingBalance,
    month,
    forecast.currency
  );
}
