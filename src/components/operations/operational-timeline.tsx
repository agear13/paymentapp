'use client';

import { cn } from '@/lib/utils';
import type { TimelineEvent } from '@/lib/operations/explainability';

export type OperationalTimelineProps = {
  events: TimelineEvent[];
  className?: string;
  maxItems?: number;
};

export function OperationalTimeline({
  events,
  className,
  maxItems = 8,
}: OperationalTimelineProps) {
  const visible = events.slice(-maxItems);

  if (visible.length === 0) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        Timeline events will appear as you configure participants, funding, and releases.
      </p>
    );
  }

  return (
    <ol className={cn('relative border-l border-border/60 ml-2 space-y-4', className)}>
      {visible.map((event) => (
        <li key={event.id} className="pl-5 relative">
          <span
            className={cn(
              'absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 bg-background',
              event.completed ? 'border-emerald-500' : 'border-muted-foreground/40'
            )}
          />
          <p className="text-sm font-medium">{event.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
          {event.timestamp ? (
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              {new Date(event.timestamp).toLocaleString()}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
