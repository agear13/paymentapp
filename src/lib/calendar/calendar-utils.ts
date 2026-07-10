import type { CalendarEvent, CalendarFilters, CalendarMonthSummary } from '@/lib/calendar/types';

export function filterCalendarEvents(
  events: CalendarEvent[],
  filters: CalendarFilters
): CalendarEvent[] {
  const q = filters.search.trim().toLowerCase();

  return events.filter((event) => {
    if (filters.projectId && event.projectId !== filters.projectId) return false;
    if (filters.participantId && event.participantId !== filters.participantId) return false;
    if (filters.category !== 'all' && event.type !== filters.category) return false;
    if (filters.currency && event.currency?.toUpperCase() !== filters.currency.toUpperCase())
      return false;
    if (filters.status && event.status.toLowerCase() !== filters.status.toLowerCase())
      return false;
    if (filters.tag && !event.tags.some((t) => t.toLowerCase() === filters.tag!.toLowerCase()))
      return false;

    if (q) {
      const haystack = [
        event.title,
        event.projectName,
        event.participantName,
        event.sourceType,
        ...Object.values(event.sourceMetadata).map(String),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

export function eventsInMonth(events: CalendarEvent[], month: Date): CalendarEvent[] {
  const y = month.getFullYear();
  const m = month.getMonth();
  return events.filter((e) => {
    const d = new Date(e.date);
    return d.getFullYear() === y && d.getMonth() === m;
  });
}

export function eventsOnDate(events: CalendarEvent[], dateKey: string): CalendarEvent[] {
  return events.filter((e) => e.date === dateKey);
}

export function deriveCalendarMonthSummary(
  events: CalendarEvent[],
  month: Date,
  activeProjectCount: number
): CalendarMonthSummary {
  const monthEvents = eventsInMonth(events, month);
  let incoming = 0;
  let outgoing = 0;
  let currency = 'AUD';

  for (const e of monthEvents) {
    if (e.currency) currency = e.currency;
    if (e.amount == null) continue;
    if (e.direction === 'incoming') incoming += e.amount;
    if (e.direction === 'outgoing') outgoing += e.amount;
  }

  const paymentsDue = monthEvents.filter(
    (e) => e.type === 'expected_revenue' && e.status !== 'PAID'
  ).length;
  const settlementReleases = monthEvents.filter(
    (e) => e.type === 'money_outgoing' && e.tags.includes('obligation')
  ).length;
  const approvalsWaiting = monthEvents.filter(
    (e) => e.type === 'operational_task' && e.tags.includes('chase_approval')
  ).length;

  return {
    incoming,
    outgoing,
    net: incoming - outgoing,
    currency,
    activeProjects: activeProjectCount,
    paymentsDue,
    settlementReleases,
    approvalsWaiting,
  };
}

export function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const list = map.get(event.date) ?? [];
    list.push(event);
    map.set(event.date, list);
  }
  return map;
}

export function upcomingEvents(events: CalendarEvent[], fromDate: string, limit = 8): CalendarEvent[] {
  return events.filter((e) => e.date >= fromDate).slice(0, limit);
}
