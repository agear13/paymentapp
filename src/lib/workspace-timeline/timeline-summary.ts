import type { BusinessFinancialSnapshot } from '@/lib/commercial/business-financial-snapshot';
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

export function deriveCashFlowForecast(
  events: WorkspaceTimelineEvent[],
  business: BusinessFinancialSnapshot | null,
  month: Date
): CashFlowForecastPoint[] {
  const currency = business?.currency ?? 'AUD';
  const startingBalance =
    business?.commercial.forecast.forecastPosition.forecastBalance ?? 0;

  const monthEvents = eventsInMonth(events, month);
  const dates = [...new Set(monthEvents.map((e) => e.date))].sort();

  if (dates.length === 0) {
    return [
      {
        date: month.toISOString().slice(0, 10),
        balance: startingBalance,
        currency,
        isDeficit: startingBalance < 0,
      },
    ];
  }

  let balance = startingBalance;
  const points: CashFlowForecastPoint[] = [];

  for (const date of dates) {
    const dayEvents = monthEvents.filter((e) => e.date === date);
    for (const e of dayEvents) {
      if (e.amount == null) continue;
      if (e.direction === 'incoming') balance += e.amount;
      if (e.direction === 'outgoing') balance -= e.amount;
    }
    points.push({ date, balance, currency, isDeficit: balance < 0 });
  }

  return points;
}
