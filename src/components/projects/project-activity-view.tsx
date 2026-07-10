'use client';

import { PRODUCT_TERMINOLOGY } from '@/lib/product/product-terminology';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import { OperationalActivitySection } from '@/components/operations/operational-activity-section';
import { OperationalTimeline } from '@/components/operations/operational-timeline';
import { useOperationalTimelineProjection } from '@/hooks/use-operational-timeline-projection';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjectPageCopilot } from '@/components/operations/project-page-copilot';

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
      {/* Persistent copilot — history is read-only, so Provvy orients the operator */}
      <ProjectPageCopilot page="history" />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{summary.name}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Business history — milestones and activity {PRODUCT_TERMINOLOGY.forThisProject}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business story</CardTitle>
          <CardDescription>
            What happened in this agreement — approvals, payments, and milestones.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <OperationalTimeline events={timelineProjection.timeline} maxItems={12} />
          <OperationalActivitySection
            projectId={projectId}
            title="Full timeline"
            defaultOpen
            maxItems={20}
          />
        </CardContent>
      </Card>
    </div>
  );
}
