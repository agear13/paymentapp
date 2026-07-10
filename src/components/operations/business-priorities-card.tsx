'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { QueueTask } from '@/components/operations/operational-queue';

const PRIORITY_DOT: Record<QueueTask['priority'], string> = {
  critical: 'text-red-500',
  high: 'text-amber-400',
  medium: 'text-muted-foreground/50',
};

type BusinessPrioritiesCardProps = {
  tasks: QueueTask[];
  loading?: boolean;
  initialMax?: number;
};

const PRIORITY_ROW: Record<QueueTask['priority'], string> = {
  critical: 'bg-red-500/[0.015]',
  high: '',
  medium: '',
};

/**
 * Business-wide priority queue — surfaces the most important actions across
 * all projects, sorted by operational impact.
 */
export function BusinessPrioritiesCard({
  tasks,
  loading = false,
  initialMax = 5,
}: BusinessPrioritiesCardProps) {
  const [expanded, setExpanded] = React.useState(false);

  if (loading) {
    return (
      <section aria-label="Business priorities" className="space-y-2.5">
        <h2 className="text-sm font-semibold text-foreground">Business priorities</h2>
        <div className="rounded-xl border border-border/60 bg-card divide-y animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 px-4 bg-muted/10" />
          ))}
        </div>
      </section>
    );
  }

  if (tasks.length === 0) return null;

  const visible = expanded ? tasks : tasks.slice(0, initialMax);
  const hidden = tasks.length - initialMax;

  return (
    <section aria-label="Business priorities" className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Business priorities</h2>
        <span className="text-xs text-muted-foreground">
          {tasks.length} item{tasks.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="rounded-xl border border-border/60 bg-card divide-y overflow-hidden">
        {visible.map((task) => (
          <div
            key={task.id}
            className={cn(
              'flex items-start gap-3 px-4 py-3.5',
              PRIORITY_ROW[task.priority]
            )}
          >
            <Circle
              className={cn('h-2 w-2 mt-1.5 shrink-0 fill-current', PRIORITY_DOT[task.priority])}
            />
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-sm font-medium leading-snug">{task.context}</p>
              <p className="text-xs text-muted-foreground leading-snug">{task.title}</p>
              {task.estimatedMinutes > 0 ? (
                <p className="text-[11px] text-muted-foreground/70">
                  ~{task.estimatedMinutes} min
                </p>
              ) : null}
            </div>
            {task.ctaHref ? (
              <Button variant="ghost" size="sm" className="shrink-0 h-8 text-xs" asChild>
                <Link href={task.ctaHref}>
                  {task.ctaLabel}
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            ) : null}
          </div>
        ))}
      </div>

      {hidden > 0 && !expanded ? (
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => setExpanded(true)}>
          Show {hidden} more
        </Button>
      ) : null}
    </section>
  );
}
