import { buildOperationalTimeline } from '@/lib/operations/explainability/operational-timeline';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import {
  projectOperationalTimeline,
  type ProjectOperationalTimelineInput,
} from '@/lib/operations/timeline/project-operational-timeline';
import type { OperationalTimelineProjection } from '@/lib/operations/timeline/types';

function fallbackProjection(workspace: WorkspaceOperationalContext): OperationalTimelineProjection {
  const timeline = buildOperationalTimeline({ workspace });
  return {
    canonicalEvents: [],
    milestones: [],
    timeline,
    confidence: {
      level: 'BLOCKED',
      score: 0,
      coveragePercent: 0,
      observedCriticalEvents: 0,
      totalCriticalEvents: 0,
      explainability: {
        headline: 'Operational events not yet recorded',
        bullets: ['Timeline derived from workspace milestones until events converge.'],
      },
    },
    blockers: [],
    replayFingerprint: '',
    degraded: true,
  };
}

/** Guarded event projection — never throws during partial hydration. */
export function safeEventProjection(
  input: ProjectOperationalTimelineInput
): OperationalTimelineProjection {
  try {
    return projectOperationalTimeline(input);
  } catch {
    return fallbackProjection(input.workspace);
  }
}
