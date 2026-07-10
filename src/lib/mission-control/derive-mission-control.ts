import { groupAgendaByUrgency } from '@/lib/workspace-timeline/timeline-filters';
import { deriveBusinessHealthCards } from '@/lib/mission-control/derive-business-health-cards';
import { deriveMissionInsights } from '@/lib/mission-control/derive-mission-insights';
import { deriveProjectsRequiringAttention } from '@/lib/mission-control/derive-project-attention';
import {
  deriveWorkspaceTasks,
  groupTasksBySeverity,
} from '@/lib/mission-control/workspace-task-engine';
import type { MissionControlDerived, WorkspaceTaskEngineInput } from '@/lib/mission-control/types';

const TIMELINE_PREVIEW_MAX = 8;

export function deriveMissionControl(
  input: WorkspaceTaskEngineInput
): MissionControlDerived {
  const today = input.currentDate ?? new Date().toISOString().slice(0, 10);
  const tasks = deriveWorkspaceTasks(input);
  const groups = groupAgendaByUrgency(input.timelineEvents, today);
  const timelinePreview = [
    ...groups.today,
    ...groups.tomorrow,
    ...groups.thisWeek,
  ].slice(0, TIMELINE_PREVIEW_MAX);

  return {
    tasks,
    tasksBySeverity: groupTasksBySeverity(tasks),
    projectAttention: deriveProjectsRequiringAttention({
      business: input.business,
      healthSnapshots: input.healthSnapshots,
    }),
    businessHealthCards: deriveBusinessHealthCards({
      business: input.business,
      timelineEvents: input.timelineEvents,
    }),
    timelinePreview,
    recommendations: deriveMissionInsights(input.business),
  };
}
