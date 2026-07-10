'use client';

import * as React from 'react';
import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import { useWorkspaceTimeline } from '@/hooks/use-workspace-timeline';
import { deriveOperationalSeverity } from '@/lib/operations/severity';
import { deduplicateAttentionItems } from '@/lib/operations/explainability/deduplicate-operational-actions';
import { deriveQueueTasksFromAttention } from '@/components/operations/operational-queue';
import { deriveMissionControl } from '@/lib/mission-control/derive-mission-control';
import type { MissionControlDerived } from '@/lib/mission-control/types';
import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import type { TimelineEvent } from '@/lib/operations/explainability/types';

export type UseMissionControlResult = {
  loading: boolean;
  error: string | null;
  mission: MissionControlDerived;
  auditEntries: OperationalAuditEntry[];
  timelineEvents: TimelineEvent[];
  dismissedTaskIds: Set<string>;
  dismissTask: (taskId: string) => void;
  restoreDismissedTasks: () => void;
};

const DISMISS_STORAGE_KEY = 'mission-control-dismissed-tasks';

function loadDismissedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveDismissedIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore storage errors
  }
}

export function useMissionControl(): UseMissionControlResult {
  const timeline = useWorkspaceTimeline();
  const { guidance, loading: coordLoading, auditTimeline, workspaceContext, kpis, timeline: coordinationTimeline } =
    useOperationalCoordinationState({
      traceSurface: 'mission-control',
    });

  const primaryAction = guidance.actions[0] ?? null;
  const attentionItems = React.useMemo(
    () =>
      deduplicateAttentionItems(
        deriveOperationalSeverity({
          guidance,
          workspace: workspaceContext,
          projectName: undefined,
          kpis,
        }),
        {
          primaryActionLabel: primaryAction?.action ?? null,
          primaryActionHref: primaryAction?.destination ?? null,
          maxCritical: 8,
          maxPerSeverity: 8,
        }
      ),
    [guidance, workspaceContext, kpis, primaryAction]
  );

  const queueTasks = React.useMemo(
    () => deriveQueueTasksFromAttention(attentionItems),
    [attentionItems]
  );

  const business = React.useMemo(() => {
    if (!timeline.business) return null;
    return {
      ...timeline.business,
      priorities: queueTasks,
    };
  }, [timeline.business, queueTasks]);

  const [dismissedTaskIds, setDismissedTaskIds] = React.useState<Set<string>>(() => loadDismissedIds());

  const dismissTask = React.useCallback((taskId: string) => {
    setDismissedTaskIds((prev) => {
      const next = new Set(prev);
      next.add(taskId);
      saveDismissedIds(next);
      return next;
    });
  }, []);

  const restoreDismissedTasks = React.useCallback(() => {
    setDismissedTaskIds(new Set());
    saveDismissedIds(new Set());
  }, []);

  const mission = React.useMemo(() => {
    const derived = deriveMissionControl({
      business,
      timelineEvents: timeline.events,
      healthSnapshots: timeline.healthSnapshots,
    });

    const visibleTasks = derived.tasks.filter((t) => !dismissedTaskIds.has(t.id));
    const tasksBySeverity = {
      high: visibleTasks.filter((t) => t.severity === 'high'),
      medium: visibleTasks.filter((t) => t.severity === 'medium'),
      low: visibleTasks.filter((t) => t.severity === 'low'),
    };

    return {
      ...derived,
      tasks: visibleTasks,
      tasksBySeverity,
    };
  }, [business, timeline.events, timeline.healthSnapshots, dismissedTaskIds]);

  return {
    loading: timeline.loading || coordLoading,
    error: timeline.error,
    mission,
    auditEntries: auditTimeline,
    timelineEvents: coordinationTimeline,
    dismissedTaskIds,
    dismissTask,
    restoreDismissedTasks,
  };
}
