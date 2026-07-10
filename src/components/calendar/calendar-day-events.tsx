'use client';

import { cn } from '@/lib/utils';
import {
  formatTimelineAmount,
  TIMELINE_LAYER_META,
} from '@/lib/workspace-timeline/timeline-layer-badges';
import type { WorkspaceTimelineEvent } from '@/lib/workspace-timeline/types';

const MAX_VISIBLE = 3;

type TimelineDayEventsProps = {
  events: WorkspaceTimelineEvent[];
  onSelect: (event: WorkspaceTimelineEvent) => void;
  compact?: boolean;
};

export function TimelineDayEvents({ events, onSelect, compact }: TimelineDayEventsProps) {
  const visible = events.slice(0, MAX_VISIBLE);
  const overflow = events.length - visible.length;

  if (events.length === 0) return null;

  return (
    <div className={cn('space-y-0.5', compact && 'space-y-px')}>
      {visible.map((event) => (
        <TimelineEventChip key={event.id} event={event} onSelect={onSelect} compact={compact} />
      ))}
      {overflow > 0 && (
        <p className="text-[10px] text-muted-foreground px-1">+{overflow} more</p>
      )}
    </div>
  );
}

function TimelineEventChip({
  event,
  onSelect,
  compact,
}: {
  event: WorkspaceTimelineEvent;
  onSelect: (event: WorkspaceTimelineEvent) => void;
  compact?: boolean;
}) {
  const meta = TIMELINE_LAYER_META[event.layer];
  const amount = formatTimelineAmount(event.amount, event.currency, event.direction);

  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      className={cn(
        'w-full text-left rounded-md border border-border/40 bg-card/80 hover:bg-muted/40 transition-colors px-1.5 py-1',
        compact && 'px-1 py-0.5'
      )}
    >
      <div className="flex items-start gap-1">
        <span className={cn('mt-1 h-1.5 w-1.5 rounded-full shrink-0', meta.dotClass)} />
        <div className="min-w-0 flex-1">
          {amount && (
            <p className={cn('text-[10px] font-semibold tabular-nums truncate', compact && 'text-[9px]')}>
              {amount}
            </p>
          )}
          <p className={cn('text-[10px] font-medium truncate text-foreground', compact && 'text-[9px]')}>
            {event.title}
          </p>
          {event.projectName && (
            <p className="text-[9px] text-muted-foreground truncate">{event.projectName}</p>
          )}
        </div>
      </div>
    </button>
  );
}

/** @deprecated Use TimelineDayEvents */
export const CalendarDayEvents = TimelineDayEvents;
