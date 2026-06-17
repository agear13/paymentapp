'use client';

import { cn } from '@/lib/utils';
import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import type { TimelineEvent } from '@/lib/operations/explainability/types';

type WorkspaceActivityFeedProps = {
  auditEntries?: OperationalAuditEntry[];
  timelineEvents?: TimelineEvent[];
  maxItems?: number;
};

/* ─── Date bucketing ─── */

function dateBucket(iso: string): 'today' | 'yesterday' | 'earlier' {
  const d = new Date(iso);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  if (d >= todayStart) return 'today';
  if (d >= yesterdayStart) return 'yesterday';
  return 'earlier';
}

function bucketLabel(bucket: 'today' | 'yesterday' | 'earlier'): string {
  if (bucket === 'today') return 'Today';
  if (bucket === 'yesterday') return 'Yesterday';
  return 'Earlier';
}

function timeOnly(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/* ─── Business Story translations ─── */

type StoryEntry = {
  headline: string;
  context: string;
  dotColor: string;
};

/**
 * Translates every audit event into business language.
 * Every story entry answers "Why does this matter?"
 * No internal event names. No system terminology.
 */
function toStoryEntry(entry: OperationalAuditEntry): StoryEntry {
  const actor = entry.actor ? ` ${entry.actor} ` : ' ';

  switch (entry.type) {
    case 'stripe_connected':
    case 'payment_rails_connected':
      return {
        headline: 'Payments are now live.',
        context: 'Your business can now begin accepting customer payments.',
        dotColor: 'bg-[rgb(124,92,255)]',
      };

    case 'agreement_approved':
      return {
        headline: entry.actor
          ? `${entry.actor} accepted the agreement.`
          : 'An agreement was accepted.',
        context: entry.description
          ? entry.description
          : 'The agreement is moving forward.',
        dotColor: 'bg-[rgb(29,111,66)]',
      };

    case 'agreement_shared':
      return {
        headline: 'Agreement was shared.',
        context: 'Participants can now review and approve the agreement.',
        dotColor: 'bg-border',
      };

    case 'funding_linked':
      return {
        headline: 'Revenue collection is configured.',
        context: 'Customers can now pay for this agreement.',
        dotColor: 'bg-[rgb(124,92,255)]',
      };

    case 'funding_reserved_against_obligations':
      return {
        headline: 'Funds are allocated.',
        context: 'Revenue has been reserved to cover payment obligations.',
        dotColor: 'bg-[rgb(124,92,255)]',
      };

    case 'obligations_generated':
    case 'obligations_funded':
      return {
        headline: 'Payment obligations are confirmed.',
        context: 'The agreement is ready for final approval before settlement.',
        dotColor: 'bg-border',
      };

    case 'payout_eligible':
      return {
        headline: entry.actor
          ? `${entry.actor} is ready to receive payment.`
          : 'A participant is ready to receive payment.',
        context: 'Payout obligations are confirmed and approved.',
        dotColor: 'bg-[rgb(29,111,66)]',
      };

    case 'release_batch_generated':
      return {
        headline: 'Payouts have been created.',
        context: 'Participants will receive their settlement payment.',
        dotColor: 'bg-[rgb(29,111,66)]',
      };

    case 'compensation_updated':
      return {
        headline: entry.actor
          ? `${entry.actor}'s earnings were updated.`
          : 'Earnings were configured.',
        context: 'Revenue shares are ready for this participant.',
        dotColor: 'bg-border',
      };

    case 'workspace_created':
      return {
        headline: 'Business was created.',
        context: 'Your commercial operations workspace is now active.',
        dotColor: 'bg-border',
      };

    case 'project_initialized':
      return {
        headline: 'New agreement started.',
        context: 'The agreement is now being prepared for coordination.',
        dotColor: 'bg-border',
      };

    case 'conversation_imported':
      return {
        headline: 'Agreement imported.',
        context: 'Agreement details were extracted and applied automatically.',
        dotColor: 'bg-[rgb(124,92,255)]',
      };

    default:
      return {
        headline: entry.title,
        context: entry.description ?? '',
        dotColor: 'bg-border',
      };
  }
}

/* ─── Component ─── */

/**
 * Business Story — tells the story of what happened, not what events fired.
 * Each entry answers: "Why does this matter to my business?"
 * Grouped Today / Yesterday / Earlier. No internal event names.
 */
export function WorkspaceActivityFeed({
  auditEntries = [],
  timelineEvents = [],
  maxItems = 10,
}: WorkspaceActivityFeedProps) {
  const hasAudit = auditEntries.length > 0;
  const hasEvents = timelineEvents.length > 0;

  if (!hasAudit && !hasEvents) {
    return (
      <section aria-label="Business story" className="space-y-2.5">
        <h2 className="text-sm font-semibold text-foreground">Business story</h2>
        <div className="rounded-xl border border-dashed border-border/50 bg-white/40 px-5 py-6 text-center space-y-1.5">
          <p className="text-sm font-medium text-foreground/70">No activity yet.</p>
          <p className="text-xs text-muted-foreground">
            Approvals, payments, and milestones will appear here as your business progresses.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Business story" className="space-y-2.5">
      <h2 className="text-sm font-semibold text-foreground">Business story</h2>
      <div className="rounded-xl border border-border/50 bg-white/50 px-4 py-4">
        {hasAudit ? (
          <BusinessStoryTimeline entries={auditEntries} maxItems={maxItems} />
        ) : (
          <EventTimeline events={timelineEvents} maxItems={maxItems} />
        )}
      </div>
    </section>
  );
}

/* ─── Grouped business story timeline ─── */

function BusinessStoryTimeline({
  entries,
  maxItems,
}: {
  entries: OperationalAuditEntry[];
  maxItems: number;
}) {
  const sorted = [...entries]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, maxItems);

  const groups: { bucket: 'today' | 'yesterday' | 'earlier'; entries: OperationalAuditEntry[] }[] =
    [];

  for (const entry of sorted) {
    const bucket = dateBucket(entry.timestamp);
    const existing = groups.find((g) => g.bucket === bucket);
    if (existing) {
      existing.entries.push(entry);
    } else {
      groups.push({ bucket, entries: [entry] });
    }
  }

  return (
    <div className="space-y-4">
      {groups.map(({ bucket, entries: bucketEntries }) => (
        <div key={bucket}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-2.5">
            {bucketLabel(bucket)}
          </p>
          <ol className="space-y-3.5">
            {bucketEntries.map((entry) => {
              const story = toStoryEntry(entry);
              return (
                <li key={entry.id} className="flex items-start gap-3">
                  <span
                    className={cn(
                      'mt-[5px] h-2 w-2 rounded-full shrink-0',
                      story.dotColor
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground/90 leading-snug">
                      {story.headline}
                    </p>
                    {story.context ? (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {story.context}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground/50 mt-0.5">
                    {timeOnly(entry.timestamp)}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

/* ─── Timeline events fallback ─── */

function EventTimeline({
  events,
  maxItems,
}: {
  events: TimelineEvent[];
  maxItems: number;
}) {
  const sorted = [...events].reverse().slice(0, maxItems);
  const withTimestamp = sorted.filter((e) => e.timestamp);
  const groups: { bucket: 'today' | 'yesterday' | 'earlier'; events: TimelineEvent[] }[] = [];

  for (const event of withTimestamp) {
    const bucket = dateBucket(event.timestamp!);
    const existing = groups.find((g) => g.bucket === bucket);
    if (existing) {
      existing.events.push(event);
    } else {
      groups.push({ bucket, events: [event] });
    }
  }

  const noTimestamp = sorted.filter((e) => !e.timestamp);
  if (noTimestamp.length > 0) {
    const ex = groups.find((g) => g.bucket === 'earlier');
    if (ex) ex.events.push(...noTimestamp);
    else groups.push({ bucket: 'earlier', events: noTimestamp });
  }

  return (
    <div className="space-y-4">
      {groups.map(({ bucket, events: bucketEvents }) => (
        <div key={bucket}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-2.5">
            {bucketLabel(bucket)}
          </p>
          <ol className="space-y-3.5">
            {bucketEvents.map((event) => (
              <li key={event.id} className="flex items-start gap-3">
                <span className="mt-[5px] h-2 w-2 rounded-full shrink-0 bg-border" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground/90 leading-snug">
                    {event.title}
                  </p>
                  {event.description ? (
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                      {event.description}
                    </p>
                  ) : null}
                </div>
                {event.timestamp ? (
                  <span className="shrink-0 text-[11px] text-muted-foreground/50 mt-0.5">
                    {timeOnly(event.timestamp)}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
