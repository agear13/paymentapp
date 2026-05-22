'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { OperationalGuidanceRegion } from '@/components/operations/operational-guidance-region';
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';
import { safeOperationalRouteState } from '@/lib/operations/routing/draft-safe-routing';

function sectionTitle(pathname: string, projectName: string): string {
  if (pathname.includes('/participants')) return `${projectName} — Participant earnings`;
  if (pathname.includes('/funding')) return `${projectName} — Funding`;
  if (pathname.includes('/payouts')) return `${projectName} — Payout releases`;
  if (pathname.includes('/obligations')) return `${projectName} — Payout obligations`;
  return projectName;
}

export function ProjectOperationalGuidance() {
  const pathname = usePathname() ?? '';
  const { deal, summary, projectParticipants, projectId } = useProjectWorkspace();
  const [treasury, setTreasury] = React.useState<ProjectTreasurySummary | null>(null);
  const prevStateRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/treasury-summary`,
          { credentials: 'include', cache: 'no-store' }
        );
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { data: ProjectTreasurySummary };
        if (!cancelled) setTreasury(json.data);
      } catch {
        if (!cancelled) setTreasury(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, summary?.treasury?.fundingSourceCount]);

  if (!deal) return null;

  // Participants page owns configuring UX — avoid duplicate guidance strip
  if (pathname.includes('/participants')) return null;

  const routeState = safeOperationalRouteState({
    projectId,
    deal,
    participants: projectParticipants,
  });

  const projectName = summary?.name ?? deal.dealName ?? 'Project';
  const showRelease =
    pathname.includes('/payouts') ||
    Boolean(pathname.match(new RegExp(`/projects/${projectId}$`))) ||
    pathname.includes('/funding');

  return (
    <OperationalGuidanceRegion
      scope="project"
      scopeTitle={sectionTitle(pathname, projectName)}
      project={deal}
      participants={routeState.participants.participants}
      treasury={treasury}
      previousProjectState={prevStateRef.current}
      showReleaseConfidence={showRelease}
      showSimulation={false}
      showExplanation={false}
      showTrust={false}
    />
  );
}
