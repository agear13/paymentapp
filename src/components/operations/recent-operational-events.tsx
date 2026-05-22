'use client';

import type { TimelineEvent } from '@/lib/operations/explainability';

const EVENT_LABELS: Record<string, string> = {
  workspace_created: 'Workspace ready',
  participant_invited: 'Participant invited',
  compensation_configured: 'Participant earnings configured',
  provider_connected: 'Payment provider connected',
  revenue_collected: 'Funding received',
  obligation_approved: 'Payout obligation approved',
  release_generated: 'Payout release created',
  settlement_completed: 'Payout settlement completed',
  state_transition: 'Status updated',
};

function humanizeEvent(event: TimelineEvent): string {
  if (event.title && !event.title.startsWith('workspace')) {
    return event.title;
  }
  return EVENT_LABELS[event.type] ?? event.title;
}

export function RecentOperationalEvents({
  events,
  compact,
}: {
  events: TimelineEvent[];
  compact?: boolean;
}) {
  const visible = [...events].reverse().slice(0, compact ? 5 : 8);

  return (
    <section
      className={compact ? 'space-y-2' : 'space-y-4 pt-6 border-t border-border/60'}
      aria-label="Recent activity"
    >
      {!compact ? <h2 className="text-sm font-semibold text-foreground">Recent activity</h2> : null}
      {visible.length === 0 ? (
        <p className="text-sm text-foreground/70">
          Activity will appear as you connect providers, add participants, and create payout
          releases.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((event) => (
            <li key={event.id} className="text-sm">
              <p className="font-medium text-foreground/90">{humanizeEvent(event)}</p>
              <p className="text-foreground/65 text-xs sm:text-sm mt-0.5 leading-snug">
                {event.description}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
