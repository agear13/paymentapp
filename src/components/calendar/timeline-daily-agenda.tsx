'use client';

import type { WorkspaceTimelineEvent } from '@/lib/workspace-timeline/types';
import { groupAgendaByUrgency } from '@/lib/workspace-timeline/timeline-filters';
import { TimelineLayerBadge } from '@/lib/workspace-timeline/timeline-layer-badge';
import { formatTimelineAmount } from '@/lib/workspace-timeline/timeline-layer-badges';

type TimelineDailyAgendaProps = {
  events: WorkspaceTimelineEvent[];
  today: string;
  onSelect: (event: WorkspaceTimelineEvent) => void;
};

function AgendaGroup({
  label,
  events,
  onSelect,
}: {
  label: string;
  events: WorkspaceTimelineEvent[];
  onSelect: (e: WorkspaceTimelineEvent) => void;
}) {
  if (events.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="space-y-1.5">
        {events.map((event) => (
          <button
            key={event.id}
            type="button"
            onClick={() => onSelect(event)}
            className="w-full text-left rounded-lg border border-border/40 px-3 py-2 hover:bg-muted/30 transition-colors space-y-1"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium truncate">{event.title}</p>
              <TimelineLayerBadge layer={event.layer} />
            </div>
            {event.projectName && (
              <p className="text-xs text-muted-foreground truncate">{event.projectName}</p>
            )}
            {formatTimelineAmount(event.amount, event.currency, event.direction) && (
              <p className="text-xs font-semibold tabular-nums">
                {formatTimelineAmount(event.amount, event.currency, event.direction)}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TimelineDailyAgenda({ events, today, onSelect }: TimelineDailyAgendaProps) {
  const groups = groupAgendaByUrgency(events, today);

  return (
    <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      <div className="rounded-xl border border-border/50 bg-card p-4 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Daily agenda
        </p>
        <AgendaGroup label="Today" events={groups.today} onSelect={onSelect} />
        <AgendaGroup label="Tomorrow" events={groups.tomorrow} onSelect={onSelect} />
        <AgendaGroup label="Next 7 days" events={groups.thisWeek} onSelect={onSelect} />
        {groups.today.length === 0 &&
          groups.tomorrow.length === 0 &&
          groups.thisWeek.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing scheduled ahead.</p>
          )}
      </div>
    </aside>
  );
}
