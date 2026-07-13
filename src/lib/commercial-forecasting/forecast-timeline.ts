/**
 * Forecast timeline — reusable monthly bars for every dashboard.
 *
 * Example:
 *   July
 *   ██████████████ Revenue
 *   ██████████     Costs
 *   ██████         Settlement
 *   ████████       Cash
 */

import type {
  CommercialForecastingInput,
  ForecastEvent,
  ForecastTimelineMonth,
} from '@/lib/commercial-forecasting/types';
import {
  ForecastEventCategory,
} from '@/lib/commercial-forecasting/types';
import { deriveForecastEvents } from '@/lib/commercial-forecasting/derive-forecast-events';
import type { YearMonth } from '@/lib/commercial-timing/types';

function periodKey(p: YearMonth): string {
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
}

function periodFromDate(date: string): YearMonth {
  const d = new Date(date);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function monthLabel(p: YearMonth): string {
  const d = new Date(p.year, p.month - 1, 1);
  return d.toLocaleString('en-AU', { month: 'long' });
}

function normalizeBar(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(1, value / max);
}

/** Build forecast timeline months from events. */
export function buildForecastTimeline(
  input: CommercialForecastingInput,
  events?: ForecastEvent[]
): ForecastTimelineMonth[] {
  const forecastEvents = events ?? deriveForecastEvents(input);
  const periodMap = new Map<
    string,
    {
      period: YearMonth;
      revenue: number;
      costs: number;
      settlement: number;
      cash: number;
      events: ForecastEvent[];
    }
  >();

  for (const event of forecastEvents) {
    const period = periodFromDate(event.date);
    const key = periodKey(period);
    const existing = periodMap.get(key) ?? {
      period,
      revenue: 0,
      costs: 0,
      settlement: 0,
      cash: 0,
      events: [],
    };

    existing.events.push(event);

    if (event.amount === null) {
      periodMap.set(key, existing);
      continue;
    }

    switch (event.category) {
      case ForecastEventCategory.CustomerPaymentExpected:
      case ForecastEventCategory.RevenueRecognised:
        existing.revenue += event.amount;
        existing.cash += event.amount;
        break;
      case ForecastEventCategory.ParticipantSettlement:
      case ForecastEventCategory.ObligationDue:
        existing.costs += event.amount;
        existing.settlement += event.amount;
        existing.cash -= event.amount;
        break;
      case ForecastEventCategory.BankPayoutClearing:
        existing.cash += event.amount;
        break;
      default:
        break;
    }

    periodMap.set(key, existing);
  }

  const months = [...periodMap.values()].sort((a, b) =>
    periodKey(a.period).localeCompare(periodKey(b.period))
  );

  const maxRevenue = Math.max(...months.map((m) => m.revenue), 0);
  const maxCosts = Math.max(...months.map((m) => m.costs), 0);
  const maxSettlement = Math.max(...months.map((m) => m.settlement), 0);
  const maxCash = Math.max(...months.map((m) => Math.abs(m.cash)), 0);

  return months.map((m) => ({
    period: m.period,
    label: monthLabel(m.period),
    revenue: m.revenue,
    costs: m.costs,
    settlement: m.settlement,
    cash: m.cash,
    revenueBar: normalizeBar(m.revenue, maxRevenue),
    costsBar: normalizeBar(m.costs, maxCosts),
    settlementBar: normalizeBar(m.settlement, maxSettlement),
    cashBar: normalizeBar(Math.abs(m.cash), maxCash),
    events: m.events,
  }));
}

/** Derive timeline for a specific number of future months from asOfDate. */
export function buildForecastTimelineRange(
  input: CommercialForecastingInput,
  monthCount: number = 6
): ForecastTimelineMonth[] {
  const full = buildForecastTimeline(input);
  const asOf = input.asOfDate ? new Date(input.asOfDate) : new Date();
  const endYear = asOf.getFullYear();
  const endMonth = asOf.getMonth() + monthCount;

  const endDate = new Date(endYear, endMonth, 1);

  return full.filter((m) => {
    const monthDate = new Date(m.period.year, m.period.month - 1, 1);
    return monthDate >= new Date(asOf.getFullYear(), asOf.getMonth(), 1) && monthDate <= endDate;
  });
}
