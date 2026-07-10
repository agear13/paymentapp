'use client';

import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { deriveCalendarMonthSummary, upcomingEvents } from '@/lib/calendar/calendar-utils';
import { formatForecastAmount } from '@/lib/commercial/commercial-forecast';
import type { CalendarEvent } from '@/lib/calendar/types';

type CalendarSummaryPanelProps = {
  events: CalendarEvent[];
  month: Date;
  activeProjectCount: number;
  onSelectEvent: (event: CalendarEvent) => void;
};

function relativeDayLabel(dateKey: string): string {
  const d = parseISO(dateKey);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'EEEE');
}

export function CalendarSummaryPanel({
  events,
  month,
  activeProjectCount,
  onSelectEvent,
}: CalendarSummaryPanelProps) {
  const summary = deriveCalendarMonthSummary(events, month, activeProjectCount);
  const today = format(new Date(), 'yyyy-MM-dd');
  const upcoming = upcomingEvents(events, today, 6);

  return (
    <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      <div className="rounded-xl border border-border/50 bg-muted/10 p-4 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Month summary
        </p>

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Incoming</dt>
            <dd className="font-semibold tabular-nums text-emerald-700">
              {formatForecastAmount(summary.incoming, summary.currency)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Outgoing</dt>
            <dd className="font-semibold tabular-nums text-orange-700">
              {formatForecastAmount(summary.outgoing, summary.currency)}
            </dd>
          </div>
          <div className="flex justify-between gap-2 pt-1 border-t border-border/40">
            <dt className="font-medium">Net</dt>
            <dd className="font-bold tabular-nums">
              {formatForecastAmount(summary.net, summary.currency)}
            </dd>
          </div>
        </dl>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs pt-2 border-t border-border/40">
          <div>
            <dt className="text-muted-foreground">Projects active</dt>
            <dd className="font-semibold text-base">{summary.activeProjects}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Payments due</dt>
            <dd className="font-semibold text-base">{summary.paymentsDue}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Settlement releases</dt>
            <dd className="font-semibold text-base">{summary.settlementReleases}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Approvals waiting</dt>
            <dd className="font-semibold text-base">{summary.approvalsWaiting}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Upcoming
        </p>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing scheduled ahead.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => onSelectEvent(event)}
                className="w-full text-left rounded-lg border border-border/40 px-3 py-2 hover:bg-muted/30 transition-colors"
              >
                <p className="text-[10px] font-medium text-muted-foreground">
                  {relativeDayLabel(event.date)}
                </p>
                <p className="text-sm font-medium truncate">{event.title}</p>
                {event.projectName && (
                  <p className="text-xs text-muted-foreground truncate">{event.projectName}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
