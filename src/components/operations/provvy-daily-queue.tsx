'use client';

/**
 * Provvy Daily Queue — "My Work"
 *
 * The canonical operations queue. Shows every commercial task that needs
 * attention, grouped by urgency.
 *
 * Consumes only `deriveCommercialTasks()`. No independent task logic.
 *
 * Groups:
 *   Today         — overdue + due today
 *   This Week     — due within 7 days
 *   Waiting       — waiting on external parties
 *   Completed     — done (collapsed by default)
 */

import * as React from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Inbox,
  TriangleAlert,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type {
  CommercialTask,
  CommercialTaskResult,
  CommercialOperationalRisk,
  TaskPriority,
} from '@/lib/commercial/commercial-task-engine';

/* ─── Props ───────────────────────────────────────────────────────────────── */

export type ProvvyDailyQueueProps = {
  taskResult: CommercialTaskResult;
  loading?: boolean;
  className?: string;
  onTaskAction?: (task: CommercialTask) => void;
};

/* ─── Main component ──────────────────────────────────────────────────────── */

export function ProvvyDailyQueue({
  taskResult,
  loading = false,
  className,
  onTaskAction,
}: ProvvyDailyQueueProps) {
  const [showCompleted, setShowCompleted] = React.useState(false);

  if (loading) {
    return (
      <div className={cn('space-y-4 animate-pulse', className)}>
        <div className="h-5 w-32 bg-muted rounded" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 bg-muted rounded-xl" />
        ))}
      </div>
    );
  }

  const { todaysTasks, thisWeekTasks, waitingTasks, completedTasks, criticalCount, overdueCount, primaryTask, risks } = taskResult;
  const totalActive = todaysTasks.length + thisWeekTasks.length + waitingTasks.length;

  if (totalActive === 0 && completedTasks.length === 0) {
    return (
      <div className={cn('rounded-xl border border-border/50 bg-card p-6 text-center space-y-2', className)}>
        <Inbox className="h-7 w-7 text-muted-foreground/40 mx-auto" />
        <p className="text-sm font-medium text-foreground">Everything is up to date</p>
        <p className="text-xs text-muted-foreground">No commercial tasks require your attention.</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-5', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">My Work</p>
          {criticalCount > 0 && (
            <Badge variant="destructive" className="text-xs h-5">
              {criticalCount} critical
            </Badge>
          )}
          {overdueCount > 0 && overdueCount > criticalCount && (
            <Badge variant="outline" className="text-xs h-5 bg-red-50 text-red-700 border-red-200">
              {overdueCount} overdue
            </Badge>
          )}
        </div>
        {totalActive > 0 && (
          <span className="text-xs text-muted-foreground">{totalActive} task{totalActive !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Critical risks callout */}
      {risks.filter((r) => r.severity === 'critical').length > 0 && (
        <RisksCallout risks={risks.filter((r) => r.severity === 'critical')} />
      )}

      {/* Primary task highlight */}
      {primaryTask && primaryTask.priority === 'critical' && (
        <PrimaryTaskCard task={primaryTask} onAction={onTaskAction} />
      )}

      {/* Today */}
      {todaysTasks.length > 0 && (
        <TaskGroup
          title="Today"
          icon={<Zap className="h-3.5 w-3.5 text-red-500" />}
          tasks={todaysTasks}
          onTaskAction={onTaskAction}
          accent="red"
        />
      )}

      {/* This Week */}
      {thisWeekTasks.length > 0 && (
        <TaskGroup
          title="This Week"
          icon={<Clock className="h-3.5 w-3.5 text-amber-500" />}
          tasks={thisWeekTasks}
          onTaskAction={onTaskAction}
          accent="amber"
        />
      )}

      {/* Waiting */}
      {waitingTasks.length > 0 && (
        <TaskGroup
          title="Waiting on Others"
          icon={<Clock className="h-3.5 w-3.5 text-muted-foreground" />}
          tasks={waitingTasks}
          onTaskAction={onTaskAction}
          accent="neutral"
        />
      )}

      {/* Completed (collapsible) */}
      {completedTasks.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowCompleted((v) => !v)}
          >
            {showCompleted ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            Completed ({completedTasks.length})
          </button>
          {showCompleted && (
            <TaskGroup
              title=""
              tasks={completedTasks}
              onTaskAction={onTaskAction}
              accent="neutral"
              dimmed
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Risks callout ──────────────────────────────────────────────────────── */

function RisksCallout({ risks }: { risks: CommercialOperationalRisk[] }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/40 p-4 space-y-2.5">
      <div className="flex items-center gap-1.5">
        <TriangleAlert className="h-4 w-4 text-red-600 shrink-0" />
        <p className="text-xs font-semibold text-red-900">
          {risks.length} critical risk{risks.length > 1 ? 's' : ''} require immediate attention
        </p>
      </div>
      <div className="space-y-2">
        {risks.slice(0, 3).map((risk) => (
          <div key={risk.id} className="space-y-0.5">
            <p className="text-xs font-medium text-red-800">{risk.title}</p>
            <p className="text-xs text-red-700/80">{risk.consequence}</p>
            <p className="text-xs font-medium text-red-900">{risk.action}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Primary task highlight ─────────────────────────────────────────────── */

function PrimaryTaskCard({
  task,
  onAction,
}: {
  task: CommercialTask;
  onAction?: (task: CommercialTask) => void;
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-card p-4 space-y-2">
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
        <span className="text-xs font-semibold text-red-800 uppercase tracking-wide">Today's Priority</span>
      </div>
      <p className="text-sm font-semibold text-foreground">{task.title}</p>
      <p className="text-xs text-muted-foreground">{task.commercialImpact}</p>
      {onAction && (
        <button
          type="button"
          onClick={() => onAction(task)}
          className="w-full text-xs font-medium bg-red-600 text-white rounded-lg py-2 hover:bg-red-700 transition-colors"
        >
          {task.action}
        </button>
      )}
    </div>
  );
}

/* ─── Task group ─────────────────────────────────────────────────────────── */

function TaskGroup({
  title,
  icon,
  tasks,
  onTaskAction,
  accent = 'neutral',
  dimmed = false,
}: {
  title: string;
  icon?: React.ReactNode;
  tasks: CommercialTask[];
  onTaskAction?: (task: CommercialTask) => void;
  accent?: 'red' | 'amber' | 'neutral';
  dimmed?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      {title && (
        <div className="flex items-center gap-1.5">
          {icon}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {title}
          </p>
        </div>
      )}
      <div className="space-y-1.5">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onAction={onTaskAction}
            dimmed={dimmed}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Individual task card ────────────────────────────────────────────────── */

function TaskCard({
  task,
  onAction,
  dimmed = false,
}: {
  task: CommercialTask;
  onAction?: (task: CommercialTask) => void;
  dimmed?: boolean;
}) {
  const isComplete = task.status === 'completed';

  return (
    <div
      className={cn(
        'rounded-xl border border-border/50 bg-card px-4 py-3 space-y-1.5',
        task.isOverdue && 'border-red-200 bg-red-50/20',
        task.priority === 'critical' && !task.isOverdue && 'border-orange-200/60',
        isComplete && 'opacity-60',
        dimmed && 'opacity-50'
      )}
    >
      {/* Top row */}
      <div className="flex items-start gap-2">
        <span className="shrink-0 mt-0.5">
          {isComplete ? (
            <Check className="h-3.5 w-3.5 text-green-600" />
          ) : task.isOverdue ? (
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
          ) : (
            <PriorityDot priority={task.priority} />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'text-xs font-medium text-foreground leading-snug',
              isComplete && 'line-through text-muted-foreground'
            )}
          >
            {task.title}
          </p>
          {task.participantName && (
            <p className="text-xs text-muted-foreground">{task.participantName}</p>
          )}
        </div>
        <DueBadge task={task} />
      </div>

      {/* Commercial impact */}
      {!isComplete && (
        <p className="text-xs text-muted-foreground leading-relaxed pl-5.5">
          {task.commercialImpact}
        </p>
      )}

      {/* Action */}
      {!isComplete && onAction && task.status !== 'waiting' && (
        <div className="pl-5.5">
          <button
            type="button"
            onClick={() => onAction(task)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {task.action} →
          </button>
        </div>
      )}

      {task.status === 'waiting' && (
        <p className="text-xs text-muted-foreground pl-5.5 italic">Waiting for response</p>
      )}
    </div>
  );
}

/* ─── Priority dot ────────────────────────────────────────────────────────── */

function PriorityDot({ priority }: { priority: TaskPriority }) {
  const classes: Record<TaskPriority, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-400',
    medium: 'bg-amber-400',
    low: 'bg-gray-300',
  };
  return (
    <span
      className={cn('inline-block h-2 w-2 rounded-full mt-1', classes[priority])}
      aria-label={priority}
    />
  );
}

/* ─── Due badge ───────────────────────────────────────────────────────────── */

function DueBadge({ task }: { task: CommercialTask }) {
  if (task.status === 'completed' || !task.dueDate) return null;

  if (task.isOverdue) {
    return (
      <Badge variant="outline" className="text-xs h-5 bg-red-50 text-red-700 border-red-200 shrink-0">
        Overdue
      </Badge>
    );
  }

  const { daysUntilDue } = task;
  if (daysUntilDue === null) return null;

  if (daysUntilDue === 0) {
    return (
      <Badge variant="outline" className="text-xs h-5 bg-orange-50 text-orange-700 border-orange-200 shrink-0">
        Today
      </Badge>
    );
  }

  if (daysUntilDue <= 3) {
    return (
      <Badge variant="outline" className="text-xs h-5 bg-amber-50 text-amber-700 border-amber-200 shrink-0">
        {daysUntilDue}d
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-xs h-5 shrink-0">
      {daysUntilDue}d
    </Badge>
  );
}
