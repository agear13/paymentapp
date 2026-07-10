'use client';

import * as React from 'react';
import { startOfWeek } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { CalendarEventDrawer } from '@/components/calendar/calendar-event-drawer';
import { CalendarFiltersBar } from '@/components/calendar/calendar-filters';
import { CalendarSummaryPanel } from '@/components/calendar/calendar-summary-panel';
import {
  CalendarAgendaView,
  CalendarMonthView,
  CalendarWeekView,
} from '@/components/calendar/calendar-views';
import type { CalendarEvent, CalendarViewMode } from '@/lib/calendar/types';

const VIEW_MODES: CalendarViewMode[] = ['month', 'week', 'agenda'];

export function CommercialOperationsCalendar() {
  const calendar = useCalendarEvents();
  const [view, setView] = React.useState<CalendarViewMode>('month');
  const [month, setMonth] = React.useState(() => new Date());
  const [weekStart, setWeekStart] = React.useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const currencies = React.useMemo(() => {
    const set = new Set<string>();
    for (const e of calendar.events) {
      if (e.currency) set.add(e.currency);
    }
    return Array.from(set).sort();
  }, [calendar.events]);

  const handleSelectEvent = React.useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setDrawerOpen(true);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            What money is expected to move, why, and what needs your attention.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border/50 p-0.5 bg-muted/20">
          {VIEW_MODES.map((mode) => (
            <Button
              key={mode}
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 px-3 text-xs capitalize',
                view === mode && 'bg-background shadow-sm'
              )}
              onClick={() => setView(mode)}
            >
              {mode}
            </Button>
          ))}
        </div>
      </div>

      <CalendarFiltersBar
        filters={calendar.filters}
        onChange={calendar.setFilters}
        deals={calendar.deals}
        currencies={currencies}
      />

      {calendar.loading ? (
        <div className="h-96 rounded-xl border border-border/40 bg-muted/20 animate-pulse" />
      ) : calendar.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50/40 p-6 text-sm text-red-700">
          {calendar.error}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
          <div className="min-w-0">
            {view === 'month' && (
              <CalendarMonthView
                month={month}
                onMonthChange={setMonth}
                events={calendar.filteredEvents}
                onSelectEvent={handleSelectEvent}
              />
            )}
            {view === 'week' && (
              <CalendarWeekView
                weekStart={weekStart}
                onWeekChange={setWeekStart}
                events={calendar.filteredEvents}
                onSelectEvent={handleSelectEvent}
              />
            )}
            {view === 'agenda' && (
              <CalendarAgendaView
                events={calendar.filteredEvents}
                onSelectEvent={handleSelectEvent}
              />
            )}
          </div>

          <CalendarSummaryPanel
            events={calendar.filteredEvents}
            month={month}
            activeProjectCount={calendar.deals.length}
            onSelectEvent={handleSelectEvent}
          />
        </div>
      )}

      <CalendarEventDrawer
        event={selectedEvent}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
