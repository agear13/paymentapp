'use client';

import * as React from 'react';
import Link from 'next/link';
import { Check, Circle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { QueueTask } from '@/components/operations/operational-queue';
import type { AgreementHealthSnapshot } from '@/lib/agreements/health/agreement-health.types';
import { projectOverviewPath } from '@/lib/projects/project-routes';
import { STAGE_COMPLETION } from '@/components/workflow/workflow-context';

type AgreementWorkflowPanelProps = {
  tasks: QueueTask[];
  snapshots: AgreementHealthSnapshot[];
};

type WorkflowGroup = {
  context: string;
  href: string;
  score: number;
  doneSteps: string[];
  pendingTasks: QueueTask[];
  estimatedMinutes: number;
};

/**
 * Derive human-readable milestone labels from the agreement's health score.
 * Uses canonical STAGE_COMPLETION thresholds so this always agrees with
 * the WorkflowStage reported by CommercialBrain.
 */
function deriveDoneSteps(score: number): string[] {
  const done: string[] = [];
  if (score >= STAGE_COMPLETION['setup'])                done.push('Agreement created');
  if (score >= STAGE_COMPLETION['configuring'])          done.push('Team added');
  if (score >= STAGE_COMPLETION['collecting-approvals']) done.push('Earnings configured');
  if (score >= STAGE_COMPLETION['preparing-payments'])   done.push('Approvals complete');
  if (score >= STAGE_COMPLETION['ready-to-collect'])     done.push('Provider connected');
  if (score >= STAGE_COMPLETION['collecting-revenue'])   done.push('Revenue collecting');
  return done;
}

function buildWorkflowGroups(
  tasks: QueueTask[],
  snapshots: AgreementHealthSnapshot[]
): WorkflowGroup[] {
  const snapshotMap = new Map<string, AgreementHealthSnapshot>(
    snapshots.map((s) => [s.agreementName.toLowerCase().trim(), s])
  );

  // Group pending tasks by agreement context
  const byContext = new Map<string, QueueTask[]>();
  for (const task of tasks) {
    const key = task.context;
    const existing = byContext.get(key) ?? [];
    byContext.set(key, [...existing, task]);
  }

  // Build groups from tasks, enriched with snapshot data
  const groups: WorkflowGroup[] = [];
  for (const [context, contextTasks] of byContext.entries()) {
    const snap =
      snapshotMap.get(context.toLowerCase().trim()) ??
      snapshots.find((s) =>
        s.agreementName.toLowerCase().includes(context.toLowerCase())
      );

    const score = snap?.score ?? 0;
    const href = snap
      ? projectOverviewPath(snap.projectId)
      : '#';

    const estimatedMinutes = contextTasks.reduce(
      (sum, t) => sum + t.estimatedMinutes,
      0
    );

    groups.push({
      context,
      href,
      score,
      doneSteps: deriveDoneSteps(score),
      pendingTasks: contextTasks.slice(0, 4),
      estimatedMinutes,
    });
  }

  // Sort by score ascending (most work needed first)
  return groups.sort((a, b) => a.score - b.score);
}

/**
 * Groups outstanding work by agreement so operators think about
 * "finishing Sunset Sessions" rather than "completing unrelated tasks."
 */
export function AgreementWorkflowPanel({
  tasks,
  snapshots,
}: AgreementWorkflowPanelProps) {
  const groups = buildWorkflowGroups(tasks, snapshots);

  if (groups.length === 0) return null;

  return (
    <section aria-label="Agreement workflows" className="space-y-2.5">
      <h2 className="text-sm font-semibold text-foreground">Today's work</h2>
      <div className="space-y-2.5">
        {groups.map((group) => (
          <WorkflowGroupCard key={group.context} group={group} />
        ))}
      </div>
    </section>
  );
}

function WorkflowGroupCard({ group }: { group: WorkflowGroup }) {
  const [expanded, setExpanded] = React.useState(true);
  const pendingCount = group.pendingTasks.length;
  const doneCount = group.doneSteps.length;

  return (
    <div className="rounded-xl border border-border/60 bg-white/60 overflow-hidden">
      {/* Card header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/10 transition-colors text-left"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{group.context}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {pendingCount} remaining action{pendingCount === 1 ? '' : 's'}
            {group.estimatedMinutes > 0 ? ` · ${group.estimatedMinutes} min` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Mini progress bar */}
          <div className="h-1.5 w-16 rounded-full bg-muted/40 hidden sm:block">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                group.score >= 80
                  ? 'bg-[rgb(29,111,66)]'
                  : group.score >= 50
                    ? 'bg-amber-500'
                    : 'bg-red-400'
              )}
              style={{ width: `${group.score}%` }}
            />
          </div>
          <span
            className={cn(
              'text-xs font-semibold tabular-nums',
              group.score >= 80
                ? 'text-[rgb(29,111,66)]'
                : group.score >= 50
                  ? 'text-amber-700'
                  : 'text-red-700'
            )}
          >
            {group.score}%
          </span>
        </div>
      </button>

      {/* Steps list */}
      {expanded ? (
        <div className="border-t border-border/40">
          {/* Done steps */}
          {group.doneSteps.map((label) => (
            <div
              key={label}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-border/30"
            >
              <div className="h-4 w-4 rounded-full bg-[rgb(29,111,66)] flex items-center justify-center shrink-0">
                <Check className="h-2.5 w-2.5 text-white" aria-hidden />
              </div>
              <span className="text-xs text-muted-foreground/70 line-through">{label}</span>
            </div>
          ))}

          {/* Pending tasks */}
          {group.pendingTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-border/30 last:border-b-0"
            >
              <Circle className="h-4 w-4 text-border shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <span className="text-sm text-foreground">{task.title}</span>
                {task.impact ? (
                  <span className="text-xs text-muted-foreground ml-1.5">{task.impact}</span>
                ) : null}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {task.estimatedMinutes} min
              </span>
            </div>
          ))}

          {/* CTA footer */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-muted/5 border-t border-border/30">
            <p className="text-xs text-muted-foreground">
              {doneCount} of {doneCount + pendingCount} steps done
            </p>
            <Button asChild size="sm" variant="outline" className="h-7 text-xs shrink-0">
              <Link href={group.href}>
                Continue workflow
                <ArrowRight className="ml-1.5 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
