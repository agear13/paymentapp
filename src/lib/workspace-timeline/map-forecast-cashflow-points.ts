import {
  ForecastEventCategory,
  type ForecastEvent,
} from '@/lib/commercial-forecasting/types';
import type { CashFlowForecastPoint } from '@/lib/workspace-timeline/types';

function forecastEventsInMonth(events: ForecastEvent[], month: Date): ForecastEvent[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  return events.filter((event) => {
    const date = new Date(event.date);
    return date.getFullYear() === year && date.getMonth() === monthIndex;
  });
}

const INFLOW_CATEGORIES = new Set<ForecastEventCategory>([
  ForecastEventCategory.CustomerPaymentExpected,
  ForecastEventCategory.BankPayoutClearing,
]);

const OUTFLOW_CATEGORIES = new Set<ForecastEventCategory>([
  ForecastEventCategory.ParticipantSettlement,
  ForecastEventCategory.ObligationDue,
  ForecastEventCategory.TaxLiabilityDue,
]);

/**
 * Map Commercial Forecasting Engine events to calendar cashflow points.
 * Does not duplicate forecast math — consumes engine output only.
 */
export function mapForecastEventsToCashFlowPoints(
  events: ForecastEvent[],
  openingBalance: number,
  month: Date,
  currency: string
): CashFlowForecastPoint[] {
  const monthEvents = forecastEventsInMonth(events, month).filter(
    (event) => !event.occurred && event.amount != null && event.amount > 0
  );

  const dates = [...new Set(monthEvents.map((event) => event.date))].sort();

  if (dates.length === 0) {
    return [
      {
        date: month.toISOString().slice(0, 10),
        balance: openingBalance,
        currency,
        isDeficit: openingBalance < 0,
      },
    ];
  }

  let balance = openingBalance;
  const points: CashFlowForecastPoint[] = [];

  for (const date of dates) {
    const dayEvents = monthEvents.filter((event) => event.date === date);
    for (const event of dayEvents) {
      if (event.amount == null) continue;
      if (INFLOW_CATEGORIES.has(event.category)) balance += event.amount;
      if (OUTFLOW_CATEGORIES.has(event.category)) balance -= event.amount;
    }
    points.push({ date, balance, currency, isDeficit: balance < 0 });
  }

  return points;
}
