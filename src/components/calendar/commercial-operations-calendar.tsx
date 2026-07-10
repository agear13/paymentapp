'use client';

import * as React from 'react';
import { startOfWeek, format } from 'date-fns';
import { useSearchParams } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWorkspaceTimeline } from '@/hooks/use-workspace-timeline';
import { TimelineEventDrawer } from '@/components/calendar/timeline-event-drawer';
import { TimelineFiltersBar } from '@/components/calendar/calendar-filters';
import { TimelineCashForecast } from '@/components/calendar/timeline-cash-forecast';
import { TimelineMonthSummaryBar } from '@/components/calendar/timeline-month-summary-bar';
import { TimelineDailyAgenda } from '@/components/calendar/timeline-daily-agenda';
import {
  TimelineAgendaView,
  TimelineMonthView,
  TimelineWeekView,
} from '@/components/calendar/calendar-views';
import type { TimelineViewMode, WorkspaceTimelineEvent, TimelineLayer, WorkspaceTimelineEventType } from '@/lib/workspace-timeline/types';

const VIEW_MODES: TimelineViewMode[] = ['month', 'week', 'agenda'];

const TIMELINE_LAYERS = new Set<TimelineLayer>(['commercial', 'accounting', 'settlement', 'operational']);

export function CommercialOperationsCalendar() {
  const searchParams = useSearchParams();
  const timeline = useWorkspaceTimeline();
  const [view, setView] = React.useState<TimelineViewMode>('month');
  const [weekStart, setWeekStart] = React.useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedEvent, setSelectedEvent] = React.useState<WorkspaceTimelineEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const currencies = React.useMemo(() => {
    const set = new Set<string>();
    for (const e of timeline.events) {
      if (e.currency) set.add(e.currency);
    }
    return Array.from(set).sort();
  }, [timeline.events]);

  const handleSelectEvent = React.useCallback((event: WorkspaceTimelineEvent) => {
    setSelectedEvent(event);
    setDrawerOpen(true);
  }, []);

  React.useEffect(() => {
    const layer = searchParams.get('layer');
    const type = searchParams.get('type');
    if (!layer && !type) return;

    timeline.setFilters((prev) => ({
      ...prev,
      ...(layer && TIMELINE_LAYERS.has(layer as TimelineLayer)
        ? { layer: layer as TimelineLayer }
        : {}),
      ...(type ? { type: type as WorkspaceTimelineEventType } : {}),
    }));
  }, [searchParams, timeline.setFilters]);

  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-bold tracking-tight">Workspace Timeline</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Commercial + accounting + settlement view across all projects.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border/50 p-0.5 bg-muted/20">
          {VIEW_MODES.map((mode) => (
            <Button
              key={mode}
              type="button"
              variant="ghost"
              size="sm"
              className={cn('h-7 px-3 text-xs capitalize', view === mode && 'bg-background shadow-sm')}
              onClick={() => setView(mode)}
            >
              {mode}
            </Button>
          ))}
        </div>
      </div>

      <TimelineMonthSummaryBar summary={timeline.monthSummary} loading={timeline.loading} />

      <TimelineCashForecast points={timeline.cashForecast} loading={timeline.loading} />

      <TimelineFiltersBar
        filters={timeline.filters}
        onChange={timeline.setFilters}
        deals={timeline.deals}
        currencies={currencies}
      />

      {timeline.loading ? (
        <div className="h-96 rounded-xl border border-border/40 bg-muted/20 animate-pulse" />
      ) : timeline.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50/40 p-6 text-sm text-red-700">
          {timeline.error}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
          <div className="min-w-0">
            {view === 'month' && (
              <TimelineMonthView
                month={timeline.month}
                onMonthChange={timeline.setMonth}
                events={timeline.monthEvents}
                onSelectEvent={handleSelectEvent}
              />
            )}
            {view === 'week' && (
              <TimelineWeekView
                weekStart={weekStart}
                onWeekChange={setWeekStart}
                events={timeline.filteredEvents}
                onSelectEvent={handleSelectEvent}
              />
            )}
            {view === 'agenda' && (
              <TimelineAgendaView
                events={timeline.filteredEvents}
                onSelectEvent={handleSelectEvent}
              />
            )}
          </div>

          <TimelineDailyAgenda
            events={timeline.filteredEvents}
            today={today}
            onSelect={handleSelectEvent}
          />
        </div>
      )}

      <TimelineEventDrawer
        event={selectedEvent}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
