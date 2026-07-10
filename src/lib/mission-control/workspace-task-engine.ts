/**
 * Workspace Task Engine
 *
 * Operational brain — derives tasks from existing lifecycle and financial state.
 * Never duplicates payment, settlement, accounting, or forecast math.
 */

import type { QueueTask } from '@/components/operations/operational-queue';
import { projectPlanningPath, projectSettlementPath } from '@/lib/projects/project-routes';
import { formatForecastAmount } from '@/lib/commercial/commercial-forecast';
import type { WorkspaceTimelineEvent } from '@/lib/workspace-timeline/types';
import type {
  WorkspaceTask,
  WorkspaceTaskEngineInput,
  WorkspaceTasksBySeverity,
  WorkspaceTaskSeverity,
  WorkspaceTaskStatus,
} from '@/lib/mission-control/types';

const SEVERITY_ORDER: Record<WorkspaceTaskSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function compareTasks(a: WorkspaceTask, b: WorkspaceTask): number {
  const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  if (sev !== 0) return sev;
  if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;
  return a.title.localeCompare(b.title);
}

function queuePriorityToSeverity(priority: QueueTask['priority']): WorkspaceTaskSeverity {
  if (priority === 'critical' || priority === 'high') return 'high';
  return 'medium';
}

function queueTaskToWorkspaceTask(task: QueueTask): WorkspaceTask {
  return {
    id: `priority:${task.id}`,
    title: task.title,
    description: task.impact,
    severity: queuePriorityToSeverity(task.priority),
    dueDate: null,
    projectId: null,
    entityType: 'workspace',
    entityId: null,
    recommendedAction: task.ctaLabel,
    href: task.ctaHref ?? null,
    reason: task.context,
    status: task.priority === 'critical' ? 'blocked' : 'needs_attention',
  };
}

function timelineImportanceToSeverity(
  importance: WorkspaceTimelineEvent['importance']
): WorkspaceTaskSeverity | null {
  if (importance === 'critical') return 'high';
  if (importance === 'high') return 'medium';
  if (importance === 'medium') return 'low';
  return null;
}

function timelineEntityType(event: WorkspaceTimelineEvent): WorkspaceTask['entityType'] {
  if (event.type === 'settlement_pending' || event.type === 'settlement_completed') {
    return 'settlement';
  }
  if (
    event.type === 'invoice_due' ||
    event.type === 'invoice_paid' ||
    event.type === 'expected_payment'
  ) {
    return 'invoice';
  }
  if (event.type === 'accounting_synced') return 'accounting';
  if (event.layer === 'settlement') return 'settlement';
  if (event.layer === 'accounting') return 'accounting';
  if (event.participantId) return 'participant';
  if (event.projectId) return 'project';
  return 'timeline';
}

function timelineStatus(event: WorkspaceTimelineEvent, today: string): WorkspaceTaskStatus {
  if (event.type === 'settlement_completed' || event.status === 'completed') return 'completed';
  if (event.date < today && (event.type === 'invoice_due' || event.type === 'expected_payment')) {
    return 'overdue';
  }
  if (event.type === 'settlement_pending' && event.importance !== 'low') return 'ready';
  if (event.type === 'cash_shortfall' || event.type === 'commercial_risk') return 'blocked';
  if (event.importance === 'critical') return 'needs_attention';
  return 'needs_attention';
}

function timelineEventToTask(event: WorkspaceTimelineEvent, today: string): WorkspaceTask | null {
  const severity = timelineImportanceToSeverity(event.importance);
  if (!severity) return null;

  const status = timelineStatus(event, today);
  if (status === 'completed') return null;

  const recommendedAction =
    event.explanation.recommendedAction ??
    event.actions[0]?.label ??
    null;
  const href = event.actions[0]?.href ?? event.sourceEntity.href ?? null;

  if (!recommendedAction && !href) return null;

  return {
    id: `timeline:${event.id}`,
    title: event.title,
    description: event.subtitle ?? event.explanation.whyThisMatters,
    severity,
    dueDate: event.date,
    projectId: event.projectId,
    entityType: timelineEntityType(event),
    entityId: event.sourceEntity.id,
    recommendedAction: recommendedAction ?? 'Open',
    href,
    reason: event.explanation.whyThisMatters,
    status,
  };
}

function projectRecordTasks(
  input: WorkspaceTaskEngineInput,
  today: string
): WorkspaceTask[] {
  const { business } = input;
  if (!business) return [];

  const tasks: WorkspaceTask[] = [];

  for (const record of business.projectRecords) {
    const { snapshot, projectId, agreementName } = record;
    const surplus = snapshot.forecast.forecastPosition.forecastSurplus;
    const currency = snapshot.currency;

    if (surplus < 0) {
      tasks.push({
        id: `forecast:${projectId}`,
        title: `Review commercial planning for ${agreementName}`,
        description: `Forecast surplus is ${formatForecastAmount(surplus, currency)}.`,
        severity: 'high',
        dueDate: today,
        projectId,
        entityType: 'project',
        entityId: projectId,
        recommendedAction: 'Review Planning',
        href: projectPlanningPath(projectId),
        reason: 'Project forecast is negative — commitments exceed expected revenue.',
        status: 'blocked',
      });
    }

    const cash = snapshot.forecast.cashReadiness;
    if (!cash.canEveryoneBePaid && cash.primaryBlocker) {
      tasks.push({
        id: `cash:${projectId}`,
        title: `Review payout blocker for ${agreementName}`,
        description: cash.primaryBlocker,
        severity: surplus < 0 ? 'high' : 'medium',
        dueDate: null,
        projectId,
        entityType: 'project',
        entityId: projectId,
        recommendedAction: 'Review settlement',
        href: projectSettlementPath(projectId),
        reason: cash.primaryBlocker,
        status: 'blocked',
      });
    }

    const readyToRelease = snapshot.settlement.readyToRelease;
    if (readyToRelease > 0 && snapshot.settlement.settlementReadiness) {
      tasks.push({
        id: `release:${projectId}`,
        title: `Release settlement for ${agreementName}`,
        description: `${formatForecastAmount(readyToRelease, currency)} is ready to release.`,
        severity: 'medium',
        dueDate: today,
        projectId,
        entityType: 'settlement',
        entityId: projectId,
        recommendedAction: 'Release settlement',
        href: projectSettlementPath(projectId),
        reason: 'Payment confirmed and settlement prerequisites are met.',
        status: 'ready',
      });
    }

    const primaryAction = snapshot.health.primaryAction;
    if (primaryAction && snapshot.health.level !== 'excellent' && snapshot.health.level !== 'good') {
      tasks.push({
        id: `health:${projectId}`,
        title: primaryAction,
        description: snapshot.health.summary,
        severity: snapshot.health.level === 'blocked' || snapshot.health.level === 'at_risk' ? 'high' : 'medium',
        dueDate: null,
        projectId,
        entityType: 'project',
        entityId: projectId,
        recommendedAction: primaryAction,
        href: projectPlanningPath(projectId),
        reason: snapshot.health.summary,
        status: 'needs_attention',
      });
    }
  }

  return tasks;
}

function healthSnapshotTasks(input: WorkspaceTaskEngineInput): WorkspaceTask[] {
  const tasks: WorkspaceTask[] = [];

  for (const snap of input.healthSnapshots) {
    if (snap.category === 'excellent' || snap.category === 'healthy') continue;

    const topFactor = snap.factors.find((f) => f.status === 'negative' || f.status === 'warning');
    const recommended =
      snap.improvesScore[0] ??
      topFactor?.improvesScoreHint ??
      'Open project';

    tasks.push({
      id: `health-snap:${snap.projectId}`,
      title: snap.categoryReason || `${snap.agreementName} needs attention`,
      description: topFactor?.detail ?? snap.categoryLabel,
      severity:
        snap.category === 'critical' || snap.category === 'at_risk' ? 'high' : 'medium',
      dueDate: null,
      projectId: snap.projectId,
      entityType: 'project',
      entityId: snap.projectId,
      recommendedAction: recommended,
      href: `/dashboard/projects/${encodeURIComponent(snap.projectId)}`,
      reason: snap.categoryReason,
      status: snap.category === 'critical' ? 'blocked' : 'needs_attention',
    });
  }

  return tasks;
}

function dedupeTasks(tasks: WorkspaceTask[]): WorkspaceTask[] {
  const seen = new Set<string>();
  return tasks.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

export function groupTasksBySeverity(tasks: WorkspaceTask[]): WorkspaceTasksBySeverity {
  const high: WorkspaceTask[] = [];
  const medium: WorkspaceTask[] = [];
  const low: WorkspaceTask[] = [];

  for (const task of tasks) {
    if (task.severity === 'high') high.push(task);
    else if (task.severity === 'medium') medium.push(task);
    else low.push(task);
  }

  return {
    high: high.sort(compareTasks),
    medium: medium.sort(compareTasks),
    low: low.sort(compareTasks),
  };
}

/**
 * Derives operational tasks from business snapshot, timeline, and health signals.
 */
export function deriveWorkspaceTasks(input: WorkspaceTaskEngineInput): WorkspaceTask[] {
  const today = input.currentDate ?? new Date().toISOString().slice(0, 10);
  const tasks: WorkspaceTask[] = [];

  if (input.business?.priorities?.length) {
    tasks.push(...input.business.priorities.map(queueTaskToWorkspaceTask));
  }

  tasks.push(...projectRecordTasks(input, today));
  tasks.push(...healthSnapshotTasks(input));

  for (const event of input.timelineEvents) {
    const task = timelineEventToTask(event, today);
    if (task) tasks.push(task);
  }

  return dedupeTasks(tasks)
    .filter((t) => t.status !== 'completed')
    .sort(compareTasks);
}
