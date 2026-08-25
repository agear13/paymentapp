'use client';

import * as React from 'react';
import Link from 'next/link';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { OperationalActivitySection } from '@/components/operations/operational-activity-section';
import { OperationalTimeline } from '@/components/operations/operational-timeline';
import { useOperationalTimelineProjection } from '@/hooks/use-operational-timeline-projection';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

export function CommercialWorkspaceActivityPanel() {
  const { deal, projectId } = useProjectWorkspace();
  const timelineProjection = useOperationalTimelineProjection({
    projectId,
    enabled: Boolean(deal),
  });

  if (!deal) return null;

  return (
    <div className="space-y-4" data-testid="commercial-workspace-activity">
      <div>
        <h2 className="text-[16px] font-semibold">Activity</h2>
        <p className="mt-1 max-w-xl text-[13px] text-ink-soft">
          Events for this workspace from the existing operational audit and timeline. The global
          Timeline remains the org-wide aggregate.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <OperationalTimeline events={timelineProjection.timeline} maxItems={12} />
        <div className="mt-4">
          <OperationalActivitySection
            projectId={projectId}
            title="Full timeline"
            defaultOpen
            maxItems={20}
            emptyMessage="No workspace activity yet."
          />
        </div>
      </div>

      <Link
        href={COMMERCIAL_OS_ROUTES.timeline}
        className="inline-flex text-[13px] font-medium text-primary hover:underline"
      >
        Open global Timeline
      </Link>
    </div>
  );
}
