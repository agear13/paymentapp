import type { TimelineFilters, WorkspaceTimelineEvent } from '@/lib/workspace-timeline/types';

export function filterTimelineEvents(
  events: WorkspaceTimelineEvent[],
  filters: TimelineFilters
): WorkspaceTimelineEvent[] {
  const q = filters.search.trim().toLowerCase();

  return events.filter((event) => {
    if (filters.projectId && event.projectId !== filters.projectId) return false;
    if (filters.participantId && event.participantId !== filters.participantId) return false;
    if (filters.layer !== 'all' && event.layer !== filters.layer) return false;
    if (filters.type !== 'all' && event.type !== filters.type) return false;
    if (filters.currency && event.currency?.toUpperCase() !== filters.currency.toUpperCase())
      return false;
    if (filters.status && event.status.toLowerCase() !== filters.status.toLowerCase())
      return false;
    if (filters.direction !== 'all' && event.direction !== filters.direction) return false;
    if (filters.person) {
      const person = filters.person.toLowerCase();
      const match =
        event.participantName?.toLowerCase().includes(person) ||
        event.metadata.customer?.toString().toLowerCase().includes(person);
      if (!match) return false;
    }
    if (filters.paymentProvider) {
      const provider = filters.paymentProvider.toLowerCase();
      if (!event.tags.some((t) => t.includes(provider)) && !String(event.metadata.paymentMethod ?? '').toLowerCase().includes(provider))
        return false;
    }

    if (q) {
      const haystack = [
        event.title,
        event.subtitle,
        event.projectName,
        event.participantName,
        event.sourceEntity.label,
        ...event.lineage.map((l) => l.label),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

export function eventsInMonth(events: WorkspaceTimelineEvent[], month: Date): WorkspaceTimelineEvent[] {
  const y = month.getFullYear();
  const m = month.getMonth();
  return events.filter((e) => {
    const d = new Date(e.date);
    return d.getFullYear() === y && d.getMonth() === m;
  });
}

export function eventsOnDate(events: WorkspaceTimelineEvent[], dateKey: string): WorkspaceTimelineEvent[] {
  return events.filter((e) => e.date === dateKey);
}

export function groupAgendaByUrgency(
  events: WorkspaceTimelineEvent[],
  today: string
): { today: WorkspaceTimelineEvent[]; tomorrow: WorkspaceTimelineEvent[]; thisWeek: WorkspaceTimelineEvent[] } {
  const tomorrowDate = new Date(today);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);

  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndKey = weekEnd.toISOString().slice(0, 10);

  const sortByImportance = (list: WorkspaceTimelineEvent[]) =>
    [...list].sort((a, b) => {
      const imp = { critical: 0, high: 1, medium: 2, low: 3 };
      return imp[a.importance] - imp[b.importance] || a.date.localeCompare(b.date);
    });

  return {
    today: sortByImportance(events.filter((e) => e.date === today)),
    tomorrow: sortByImportance(events.filter((e) => e.date === tomorrow)),
    thisWeek: sortByImportance(
      events.filter((e) => e.date > tomorrow && e.date <= weekEndKey)
    ),
  };
}
