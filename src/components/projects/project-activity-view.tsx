'use client';

import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import { OperationalActivitySection } from '@/components/operations/operational-activity-section';
import { OperationalTimeline } from '@/components/operations/operational-timeline';
import { useOperationalTimelineProjection } from '@/hooks/use-operational-timeline-projection';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ProjectActivityView() {
  const { deal, summary, projectParticipants, projectId } = useProjectWorkspace();
  useOperationalCoordinationState({
    scope: 'project',
    project: deal ?? undefined,
    participants: projectParticipants,
    enabled: Boolean(deal),
    traceSurface: 'project-activity-view',
  });
  const timelineProjection = useOperationalTimelineProjection({
    projectId,
    enabled: Boolean(deal),
  });

  if (!deal || !summary) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{summary.name}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Operational audit timeline for this project — canonical coordination events.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operational activity</CardTitle>
          <CardDescription>
            Agreement, funding, obligation, and release events from the coordination graph.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <OperationalTimeline events={timelineProjection.timeline} maxItems={12} />
          <OperationalActivitySection
            projectId={projectId}
            title="Project timeline"
            defaultOpen
            maxItems={20}
          />
        </CardContent>
      </Card>
    </div>
  );
}
