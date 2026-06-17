'use client';

import * as React from 'react';
import Link from 'next/link';
import { Circle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AttentionItem, OperationalSeverity } from '@/lib/operations/severity';
import type { OperationalAction } from '@/lib/operations/explainability/types';

/* ─── Types ─── */

export type QueueTask = {
  id: string;
  priority: 'critical' | 'high' | 'medium';
  title: string;
  context: string;
  estimatedMinutes: number;
  impact: string;
  ctaLabel: string;
  ctaHref?: string;
};

/* ─── Derivation helpers ─── */

const TIME_PATTERNS: [RegExp, number][] = [
  [/connect stripe|payment provider/i, 5],
  [/send.*agreement|participation agreement/i, 2],
  [/release payout|release batch/i, 1],
  [/allocate funding|review funding/i, 2],
  [/configure.*payout|payout account|bank account/i, 3],
  [/review.*obligation|approve settlement/i, 4],
  [/send reminder/i, 1],
];

function estimateMinutes(text: string): number {
  for (const [pattern, mins] of TIME_PATTERNS) {
    if (pattern.test(text)) return mins;
  }
  return 3;
}

function severityToPriority(s: OperationalSeverity): QueueTask['priority'] {
  if (s === 'CRITICAL') return 'critical';
  if (s === 'ACTION_REQUIRED') return 'high';
  return 'medium';
}

export function deriveQueueTasksFromAttention(
  items: AttentionItem[]
): QueueTask[] {
  return items
    .filter((i) => i.severity === 'CRITICAL' || i.severity === 'ACTION_REQUIRED')
    .map((i): QueueTask => ({
      id: i.id,
      priority: severityToPriority(i.severity),
      title: i.title,
      context: i.projectName ?? 'Business setup',
      estimatedMinutes: estimateMinutes(i.title + ' ' + i.explanation),
      impact: i.confidenceImpact ?? i.explanation,
      ctaLabel: i.ctaLabel ?? (i.severity === 'CRITICAL' ? 'Fix' : 'Review'),
      ctaHref: i.ctaHref,
    }))
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2 };
      return order[a.priority] - order[b.priority];
    });
}

/* ─── Styles ─── */

const PRIORITY_DOT: Record<QueueTask['priority'], string> = {
  critical: 'text-red-500',
  high: 'text-amber-400',
  medium: 'text-muted-foreground/50',
};

const PRIORITY_ROW: Record<QueueTask['priority'], string> = {
  critical: 'bg-red-500/[0.015]',
  high: '',
  medium: '',
};

const PRIORITY_LABEL: Record<QueueTask['priority'], string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
};

/* ─── Component ─── */

type OperationalQueueProps = {
  tasks: QueueTask[];
  initialMax?: number;
};

/**
 * Global operational queue — aggregates outstanding work across all agreements.
 * Sorted by operational impact: critical blockers first.
 */
export function OperationalQueue({ tasks, initialMax = 5 }: OperationalQueueProps) {
  const [expanded, setExpanded] = React.useState(false);

  if (tasks.length === 0) return null;

  const visible = expanded ? tasks : tasks.slice(0, initialMax);
  const hidden = tasks.length - initialMax;

  const totalMinutes = tasks
    .slice(0, initialMax)
    .reduce((sum, t) => sum + t.estimatedMinutes, 0);

  return (
    <section aria-label="Today's work" className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-foreground">Today's work</h2>
          <span className="text-xs text-muted-foreground">
            {tasks.length} task{tasks.length === 1 ? '' : 's'}
          </span>
        </div>
        {totalMinutes > 0 ? (
          <span className="text-xs text-muted-foreground">
            ~{totalMinutes} min{totalMinutes === 1 ? '' : 's'} to clear
          </span>
        ) : null}
      </div>

      <div className="rounded-xl border border-border/60 bg-white/60 overflow-hidden divide-y divide-border/40">
        {visible.map((task) => (
          <QueueRow key={task.id} task={task} />
        ))}
      </div>

      {!expanded && hidden > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors duration-100 py-1.5 text-center"
        >
          View {hidden} more task{hidden === 1 ? '' : 's'}
        </button>
      ) : null}
    </section>
  );
}

function QueueRow({ task }: { task: QueueTask }) {
  return (
    <div
      className={cn(
        'flex items-start gap-3.5 px-4 py-3.5 hover:bg-muted/20 transition-colors duration-100',
        PRIORITY_ROW[task.priority]
      )}
    >
      {/* Priority dot */}
      <Circle
        className={cn('h-2.5 w-2.5 mt-1.5 shrink-0 fill-current', PRIORITY_DOT[task.priority])}
        aria-label={PRIORITY_LABEL[task.priority]}
      />

      {/* Task content */}
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium text-foreground leading-snug">{task.title}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span>{task.context}</span>
          {task.impact ? (
            <>
              <span aria-hidden>·</span>
              <span>{task.impact}</span>
            </>
          ) : null}
          <span aria-hidden>·</span>
          <span>{task.estimatedMinutes} min</span>
        </div>
      </div>

      {/* CTA */}
      {task.ctaHref ? (
        <Button asChild size="sm" variant="outline" className="shrink-0 h-7 text-xs mt-0.5">
          <Link href={task.ctaHref}>
            {task.ctaLabel}
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
