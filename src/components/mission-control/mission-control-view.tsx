'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { opPage } from '@/lib/design/operational-spacing';
import { useMissionControl } from '@/hooks/use-mission-control';
import { WorkspaceActivityFeed } from '@/components/operations/workspace-activity-feed';
import { TimelineLayerBadge } from '@/lib/workspace-timeline/timeline-layer-badges';
import { formatTimelineAmount } from '@/lib/workspace-timeline/timeline-layer-badges';
import type { WorkspaceTask, WorkspaceTaskSeverity } from '@/lib/mission-control/types';
import type { BusinessHealthCard } from '@/lib/mission-control/types';
import type { WorkspaceTimelineEvent } from '@/lib/workspace-timeline/types';
import { PRODUCT_TERMINOLOGY } from '@/lib/product/product-terminology';

function missionGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function MissionSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="border-t border-border/40 pt-8 first:border-t-0 first:pt-0">
        <h2 className="text-sm font-semibold text-foreground tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

const SEVERITY_LABEL: Record<WorkspaceTaskSeverity, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const SEVERITY_DOT: Record<WorkspaceTaskSeverity, string> = {
  high: 'text-red-500',
  medium: 'text-amber-400',
  low: 'text-muted-foreground/50',
};

const HEALTH_STATUS_RING: Record<BusinessHealthCard['status'], string> = {
  healthy: 'border-emerald-200/60',
  attention: 'border-amber-200/60',
  blocked: 'border-red-200/60',
  neutral: 'border-border/50',
};

function PriorityTaskCard({
  task,
  onDismiss,
}: {
  task: WorkspaceTask;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card px-4 py-3.5 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{task.title}</p>
          <p className="text-xs text-muted-foreground line-clamp-2">{task.reason}</p>
        </div>
        <Circle className={cn('h-2 w-2 mt-1.5 shrink-0 fill-current', SEVERITY_DOT[task.severity])} />
      </div>
      <div className="flex items-center gap-2">
        {task.href ? (
          <Button asChild size="sm" variant="outline" className="h-7 text-xs">
            <Link href={task.href}>Open</Link>
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-muted-foreground"
          onClick={() => onDismiss(task.id)}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}

function PrioritiesSection({
  tasksBySeverity,
  onDismiss,
}: {
  tasksBySeverity: ReturnType<typeof useMissionControl>['mission']['tasksBySeverity'];
  onDismiss: (id: string) => void;
}) {
  const total =
    tasksBySeverity.high.length +
    tasksBySeverity.medium.length +
    tasksBySeverity.low.length;

  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Nothing needs your attention right now. Your workspace is up to date.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {(['high', 'medium', 'low'] as const).map((severity) => {
        const tasks = tasksBySeverity[severity];
        if (tasks.length === 0) return null;
        return (
          <div key={severity} className="space-y-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {SEVERITY_LABEL[severity]}
            </p>
            <div className="space-y-2">
              {tasks.map((task) => (
                <PriorityTaskCard key={task.id} task={task} onDismiss={onDismiss} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BusinessHealthSection({ cards }: { cards: BusinessHealthCard[] }) {
  const router = useRouter();

  if (cards.length === 0) {
    return <p className="text-sm text-muted-foreground">Loading business health…</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={() => router.push(card.timelineHref)}
          className={cn(
            'rounded-xl border bg-card px-4 py-3.5 text-left transition-colors hover:bg-muted/20',
            HEALTH_STATUS_RING[card.status]
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {card.label}
          </p>
          <p className="text-lg font-semibold tracking-tight mt-1">{card.value}</p>
          {card.detail ? (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{card.detail}</p>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function TimelinePreviewEvent({ event }: { event: WorkspaceTimelineEvent }) {
  const href = event.actions[0]?.href;
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium truncate">{event.title}</p>
        <TimelineLayerBadge layer={event.layer} />
      </div>
      {event.projectName ? (
        <p className="text-xs text-muted-foreground truncate">{event.projectName}</p>
      ) : null}
      {formatTimelineAmount(event.amount, event.currency, event.direction) ? (
        <p className="text-xs font-semibold tabular-nums">
          {formatTimelineAmount(event.amount, event.currency, event.direction)}
        </p>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-lg border border-border/40 px-3 py-2 hover:bg-muted/30 transition-colors space-y-1"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-lg border border-border/40 px-3 py-2 space-y-1">{content}</div>
  );
}

function TimelinePreviewSection({ events }: { events: WorkspaceTimelineEvent[] }) {
  return (
    <div className="space-y-4">
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing scheduled in the next seven days.</p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <TimelinePreviewEvent key={event.id} event={event} />
          ))}
        </div>
      )}
      <Button asChild variant="outline" size="sm" className="h-8 text-xs">
        <Link href="/dashboard/calendar">
          Open Timeline
          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Link>
      </Button>
    </div>
  );
}

function ProjectAttentionSection({
  projects,
}: {
  projects: ReturnType<typeof useMissionControl>['mission']['projectAttention'];
}) {
  if (projects.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        All {PRODUCT_TERMINOLOGY.projectsLower} are progressing without blockers.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {projects.map((project) => (
        <div
          key={project.projectId}
          className="rounded-xl border border-border/50 bg-card px-4 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        >
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-medium">{project.projectName}</p>
            <p className="text-xs text-muted-foreground">
              {project.commercialHealth} · {project.reason}
            </p>
            <p className="text-xs text-foreground/80">{project.recommendedAction}</p>
          </div>
          <Button asChild size="sm" variant="outline" className="h-7 text-xs shrink-0">
            <Link href={project.href}>{PRODUCT_TERMINOLOGY.openProject}</Link>
          </Button>
        </div>
      ))}
    </div>
  );
}

function RecommendationsSection({ recommendations }: { recommendations: string[] }) {
  if (recommendations.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3.5 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Recommended
      </p>
      <ul className="space-y-1.5">
        {recommendations.map((line) => (
          <li key={line} className="text-sm text-foreground/90">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MissionControlView() {
  const { loading, mission, auditEntries, timelineEvents, dismissTask } = useMissionControl();

  if (loading) {
    return (
      <div className={cn(opPage(), 'animate-pulse space-y-8')}>
        <div className="h-8 w-48 bg-muted rounded" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 bg-muted/40 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className={opPage()}>
      <header className="space-y-1 pb-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {missionGreeting()}
        </h1>
        <p className="text-sm text-muted-foreground">Mission Control</p>
      </header>

      {mission.recommendations.length > 0 ? (
        <RecommendationsSection recommendations={mission.recommendations} />
      ) : null}

      <MissionSection title="Today's Priorities">
        <PrioritiesSection tasksBySeverity={mission.tasksBySeverity} onDismiss={dismissTask} />
      </MissionSection>

      <MissionSection title="Business Health">
        <BusinessHealthSection cards={mission.businessHealthCards} />
      </MissionSection>

      <MissionSection title="Upcoming Timeline">
        <TimelinePreviewSection events={mission.timelinePreview} />
      </MissionSection>

      <MissionSection title="Projects Requiring Attention">
        <ProjectAttentionSection projects={mission.projectAttention} />
      </MissionSection>

      <MissionSection title="Recent Activity">
        <WorkspaceActivityFeed
          auditEntries={auditEntries}
          timelineEvents={timelineEvents}
          maxItems={8}
        />
      </MissionSection>
    </div>
  );
}
