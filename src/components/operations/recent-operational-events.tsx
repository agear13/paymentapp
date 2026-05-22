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

export function RecentOperationalEvents({ events }: { events: TimelineEvent[] }) {
  const visible = [...events].reverse().slice(0, 8);

  return (
    <section className="space-y-4 pt-6 border-t border-border/60" aria-label="Recent activity">
      <h2 className="text-sm font-semibold">Recent activity</h2>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Activity will appear as you connect providers, add participants, and create payout
          releases.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((event) => (
            <li key={event.id} className="text-sm">
              <p className="font-medium text-foreground/90">{humanizeEvent(event)}</p>
              <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">
                {event.description}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
