'use client';

import '@/components/journey/lovable/lovable-journey.css';
import Link from 'next/link';
import {
  Activity,
  Check,
  ChevronRight,
  CreditCard,
  FileText,
  Landmark,
  Plug,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { useCommercialTimeline } from '@/hooks/use-commercial-timeline';
import { formatTimelineTime } from '@/lib/workspace-timeline/commercial-timeline-mapper';
import {
  findRelatedTimelineEvents,
  relatedActivityLabel,
  timelineClusterKey,
} from '@/lib/workspace-timeline/commercial-timeline-related';
import {
  COMMERCIAL_TIMELINE_FILTERS,
  type CommercialTimelineCategory,
  type CommercialTimelineEvent,
  type CommercialTimelineFilter,
} from '@/lib/workspace-timeline/commercial-timeline-types';
import { cn } from '@/lib/utils';

const FILTER_LABELS: Record<CommercialTimelineFilter, string> = {
  all: 'All activity',
  payment: 'Payments',
  agreement: 'Agreements',
  settlement: 'Settlement',
  referral: 'Referrals',
  accounting: 'Accounting',
  system: 'System',
};

const CATEGORY_TONE: Record<
  CommercialTimelineCategory,
  { icon: typeof CreditCard; className: string }
> = {
  payment: { icon: CreditCard, className: 'bg-emerald-500/15 text-emerald-700' },
  agreement: { icon: FileText, className: 'bg-sky-500/15 text-sky-700' },
  settlement: { icon: Landmark, className: 'bg-amber-500/15 text-amber-800' },
  referral: { icon: Users, className: 'bg-violet-500/15 text-violet-700' },
  accounting: { icon: RefreshCw, className: 'bg-teal-500/15 text-teal-700' },
  connected_system: { icon: Plug, className: 'bg-secondary text-ink-soft' },
  system: { icon: Check, className: 'bg-secondary text-ink-soft' },
};

const CLUSTER_DOTS = [
  'bg-emerald-500/70',
  'bg-sky-500/70',
  'bg-violet-500/70',
  'bg-amber-500/70',
  'bg-teal-500/70',
  'bg-rose-500/70',
];

function clusterDotClass(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) % CLUSTER_DOTS.length;
  return CLUSTER_DOTS[hash] ?? CLUSTER_DOTS[0];
}

function TimelineEventRow({
  event,
  allEvents,
  clusterCounts,
}: {
  event: CommercialTimelineEvent;
  allEvents: CommercialTimelineEvent[];
  clusterCounts: Map<string, number>;
}) {
  const [expanded, setExpanded] = useState(false);
  const tone = CATEGORY_TONE[event.category];
  const Icon = tone.icon;
  const supporting = event.importance === 'supporting';
  const system = event.importance === 'system';
  const related = useMemo(() => findRelatedTimelineEvents(event, allEvents), [event, allEvents]);
  const clusterKey = timelineClusterKey(event);
  const showCluster = Boolean(clusterKey && (clusterCounts.get(clusterKey) ?? 0) > 1);

  const body = (
    <>
      <div
        className={cn(
          'relative z-10 mt-0.5 grid h-7 w-7 place-items-center rounded-lg',
          system ? 'bg-secondary text-ink-soft' : tone.className,
          supporting ? 'opacity-70' : null
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'flex items-center gap-1.5 text-[13.5px]',
            system || supporting ? 'font-normal text-ink-soft' : 'font-medium'
          )}
        >
          {showCluster && clusterKey ? (
            <span
              className={cn('h-1.5 w-1.5 shrink-0 rounded-full', clusterDotClass(clusterKey))}
              title={clusterKey.startsWith('payment:') ? 'Same payment' : 'Same deal'}
              aria-hidden
            />
          ) : null}
          {event.title}
        </div>
        {event.description ? (
          <div className="text-[12px] text-ink-soft">{event.description}</div>
        ) : null}
      </div>
      <div className="whitespace-nowrap text-[11.5px] text-ink-soft">
        {formatTimelineTime(event.occurredAt)}
      </div>
    </>
  );

  const rowClass = 'relative flex min-w-0 flex-1 items-start gap-3 rounded-lg py-2.5 pl-4 pr-2';

  return (
    <div>
      <div className="flex items-start">
        {event.href ? (
          <Link href={event.href} className={cn(rowClass, 'transition-colors hover:bg-secondary/60')}>
            {body}
          </Link>
        ) : (
          <div className={rowClass}>{body}</div>
        )}
        {related.length > 0 ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? 'Hide related activity' : 'Related activity'}
            onClick={() => setExpanded((open) => !open)}
            className="mt-2 mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-ink-soft hover:bg-secondary/60"
          >
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')} />
          </button>
        ) : (
          <div className="mr-1 w-7 shrink-0" />
        )}
      </div>
      {expanded && related.length > 0 ? (
        <div className="mb-2 ml-11 mr-9 rounded-lg border border-border/70 bg-secondary/30 px-3 py-2">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            {relatedActivityLabel(event, related)}
          </div>
          <div className="mt-1.5 space-y-1.5">
            {related.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[12.5px] text-ink">{item.title}</div>
                  {item.description ? (
                    <div className="text-[11.5px] text-ink-soft">{item.description}</div>
                  ) : null}
                </div>
                <div className="whitespace-nowrap text-[11px] text-ink-soft">
                  {formatTimelineTime(item.occurredAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function WorkspaceTimelineScreen() {
  const {
    loading,
    error,
    groups,
    participants,
    relationshipNames,
    events,
    filteredEvents,
    hasCommercialActivity,
    accountState,
    completeness,
    category,
    setCategory,
    relationshipFilter,
    setRelationshipFilter,
  } = useCommercialTimeline();

  const clusterCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of filteredEvents) {
      const key = timelineClusterKey(item);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [filteredEvents]);

  return (
    <div className="animate-fade-up space-y-8 pb-16">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-ink-soft">
          <Activity className="h-3 w-3" />
          Commercial Timeline
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          Every commercial event, one continuous story.
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-soft">
          A chronological record of what has actually happened in this business — payments,
          agreements, settlement, referrals, and accounting.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {COMMERCIAL_TIMELINE_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setCategory(filter)}
            className={cn(
              'rounded-full border px-3 py-1 text-[12px] transition-colors',
              category === filter
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-ink-soft hover:bg-secondary/60'
            )}
          >
            {FILTER_LABELS[filter]}
          </button>
        ))}
        {participants.length > 0 || relationshipNames.length > 0 ? (
          <select
            value={relationshipFilter}
            onChange={(event) => setRelationshipFilter(event.target.value)}
            className="rounded-full border border-border bg-card px-3 py-1 text-[12px] text-ink-soft"
            aria-label="Filter by participant or relationship"
          >
            <option value="">All relationships</option>
            {participants.map((participant) => (
              <option key={`participant:${participant.id}`} value={`participant:${participant.id}`}>
                {participant.name}
              </option>
            ))}
            {relationshipNames.map((name) => (
              <option key={`relationship:${name}`} value={`relationship:${name}`}>
                {name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-border bg-card px-5 py-4 text-[13px] text-ink-soft">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-border bg-card px-5 py-10 text-[13px] text-ink-soft">
          Loading commercial activity…
        </div>
      ) : null}

      {!loading && accountState === 'no_organization' ? (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/30 px-5 py-8">
          <div className="text-[15px] font-medium">This workspace is still being set up</div>
          <p className="mt-2 max-w-2xl text-[13px] text-ink-soft">
            Commercial activity will appear here once the account is ready. Nothing has been
            invented for this view.
          </p>
        </div>
      ) : null}

      {!loading && accountState === 'empty' ? (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/30 px-5 py-8">
          <div className="text-[15px] font-medium">Your commercial activity will appear here</div>
          <p className="mt-2 max-w-2xl text-[13px] text-ink-soft">
            As you create invoices, receive payments, manage agreements, and settle obligations,
            Provvy will build a chronological record of how your business operates.
          </p>
        </div>
      ) : null}

      {!loading && completeness.complete === false ? (
        <div className="rounded-2xl border border-border bg-secondary/30 px-5 py-3 text-[13px] text-ink-soft">
          Older commercial activity may not be shown yet. This view is loading the most recent
          history from each connected workflow.
        </div>
      ) : null}

      {!loading && groups.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="space-y-8">
            {groups.map((group) => (
              <div key={group.key}>
                <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                  {group.label}
                </div>
                <div className="relative mt-3 space-y-1 pl-3">
                  <div className="absolute bottom-2 left-[13px] top-2 w-px bg-border" />
                  {group.events.map((event) => (
                    <TimelineEventRow
                      key={event.id}
                      event={event}
                      allEvents={events}
                      clusterCounts={clusterCounts}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && !error && hasCommercialActivity && groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/30 px-5 py-4 text-[13px] text-ink-soft">
          No {FILTER_LABELS[category].toLowerCase()} matching this filter.
        </div>
      ) : null}

      <div className="rounded-2xl border border-dashed border-border bg-secondary/30 px-5 py-4 text-[13px] text-ink-soft">
        Timeline events come from real records in this account — invoices, payments, agreements,
        settlement, referrals, and{' '}
        <Link href={COMMERCIAL_OS_ROUTES.connected} className="font-medium text-primary hover:underline">
          connected systems
        </Link>
        .
      </div>
    </div>
  );
}
