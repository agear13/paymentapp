'use client';

import * as React from 'react';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CalendarDayEvents } from '@/components/calendar/calendar-day-events';
import { eventsOnDate } from '@/lib/calendar/calendar-utils';
import type { CalendarEvent } from '@/lib/calendar/types';

type CalendarMonthViewProps = {
  month: Date;
  onMonthChange: (month: Date) => void;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
};

export function CalendarMonthView({
  month,
  onMonthChange,
  events,
  onSelectEvent,
}: CalendarMonthViewProps) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{format(month, 'MMMM yyyy')}</h2>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onMonthChange(addMonths(month, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => onMonthChange(new Date())}
          >
            Today
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onMonthChange(addMonths(month, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px rounded-xl border border-border/50 bg-border/30 overflow-hidden">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div
            key={d}
            className="bg-muted/20 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {d}
          </div>
        ))}

        {days.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsOnDate(events, dateKey);
          const inMonth = isSameMonth(day, month);

          return (
            <div
              key={dateKey}
              className={cn(
                'min-h-[100px] bg-background p-1.5 flex flex-col gap-1',
                !inMonth && 'bg-muted/10'
              )}
            >
              <span
                className={cn(
                  'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                  isToday(day) && 'bg-foreground text-background',
                  !inMonth && 'text-muted-foreground/50'
                )}
              >
                {format(day, 'd')}
              </span>
              <CalendarDayEvents events={dayEvents} onSelect={onSelectEvent} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

type CalendarWeekViewProps = {
  weekStart: Date;
  onWeekChange: (start: Date) => void;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
};

export function CalendarWeekView({
  weekStart,
  onWeekChange,
  events,
  onSelectEvent,
}: CalendarWeekViewProps) {
  const days = eachDayOfInterval({
    start: weekStart,
    end: endOfWeek(weekStart, { weekStartsOn: 1 }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {format(days[0], 'd MMM')} – {format(days[days.length - 1], 'd MMM yyyy')}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onWeekChange(addDays(weekStart, -7))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onWeekChange(addDays(weekStart, 7))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-3">
        {days.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsOnDate(events, dateKey);
          return (
            <div key={dateKey} className="rounded-xl border border-border/50 bg-card p-3 min-h-[200px] space-y-2">
              <p className={cn('text-sm font-semibold', isToday(day) && 'text-primary')}>
                {format(day, 'EEE d')}
              </p>
              <CalendarDayEvents events={dayEvents} onSelect={onSelectEvent} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

type CalendarAgendaViewProps = {
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
};

export function CalendarAgendaView({ events, onSelectEvent }: CalendarAgendaViewProps) {
  const grouped = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  if (grouped.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 py-16 text-center">
        <p className="text-sm text-muted-foreground">No events match your filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map(([dateKey, dayEvents]) => (
        <div key={dateKey} className="space-y-2">
          <p className="text-sm font-semibold text-foreground">
            {format(parseISO(dateKey), 'EEEE d MMMM yyyy')}
          </p>
          <div className="space-y-2">
            {dayEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => onSelectEvent(event)}
                className="w-full text-left rounded-lg border border-border/50 bg-card px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <CalendarDayEvents events={[event]} onSelect={onSelectEvent} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
