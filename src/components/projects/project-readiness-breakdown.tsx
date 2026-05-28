'use client';

import Link from 'next/link';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { OperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import { deriveParticipantOperationalBlockers } from '@/lib/operations/blockers/payout-blockers';
import { hydrateParticipants, participantEntity } from '@/lib/operations/hydration/hydrate-participant';
import { summarizeProjectReadinessGaps } from '@/lib/operations/readiness/participant-readiness';
import { warnLegacyOperationalPath } from '@/lib/operations/dev/warn-legacy-operational-path';
import { formatParticipantPayoutReadiness } from '@/lib/projects/format-participant-payout-readiness';
import { Button } from '@/components/ui/button';

type GraphParticipantRow = {
  participantId?: string;
  name?: string;
  releaseReady?: boolean;
  blockers?: OperationalCoordinationSnapshot['participants'][number]['blockers'];
  readinessHierarchy?: OperationalCoordinationSnapshot['participants'][number]['readinessHierarchy'];
};

type ProjectReadinessBreakdownProps = {
  participants: DemoParticipant[];
  projectId?: string;
  className?: string;
  graphParticipants?: GraphParticipantRow[];
  graphSummary?: OperationalCoordinationSnapshot['summary'];
};

/** Readiness breakdown — graph-derived when graphParticipants provided. */
export function ProjectReadinessBreakdown({
  participants,
  projectId,
  className,
  graphParticipants,
  graphSummary,
}: ProjectReadinessBreakdownProps) {
  if (graphParticipants && graphSummary) {
    const total = graphSummary.participantCount;
    const releaseReady = graphSummary.releaseReadyCount;
    const blockers = graphParticipants.flatMap((p) => p.blockers ?? []);

    if (total === 0) {
      return (
        <p className={className ?? 'text-sm text-muted-foreground'}>No participants added yet</p>
      );
    }

    return (
      <div className={className ?? 'space-y-3'}>
        <p className="text-sm text-muted-foreground">
          {releaseReady} of {total} release-ready
        </p>
        {graphSummary.blockerCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            {graphSummary.blockerCount} operational blocker(s) across participants
          </p>
        ) : null}
        {blockers.length > 0 ? (
          <ul className="space-y-3 text-xs border-t border-border/25 pt-2">
            {blockers.slice(0, 6).map((b) => (
              <li key={b.id} className="space-y-1">
                <p className="font-medium text-amber-800/90 dark:text-amber-400/90">
                  {b.requiredAction}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground/80">Who must act:</span>{' '}
                  {b.ownerLabel}
                </p>
                <p className="text-muted-foreground leading-relaxed">{b.explanation}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  const safeList = hydrateParticipants(participants).map(participantEntity);
  warnLegacyOperationalPath('summarizeProjectReadinessGaps', 'project-readiness-breakdown-fallback');
  const gaps = summarizeProjectReadinessGaps(safeList);

  if (gaps.total === 0) {
    return (
      <p className={className ?? 'text-sm text-muted-foreground'}>No participants added yet</p>
    );
  }

  const blockers = safeList.flatMap((p) => deriveParticipantOperationalBlockers(p, projectId));

  return (
    <div className={className ?? 'space-y-3'}>
      <p className="text-sm text-muted-foreground">
        {formatParticipantPayoutReadiness(gaps.payoutReadyCount, gaps.total)}
      </p>
      {blockers.length > 0 ? (
        <ul className="space-y-3 text-xs border-t border-border/25 pt-2">
          {blockers.slice(0, 6).map((b) => (
            <li key={b.id} className="space-y-1">
              <span className="font-medium text-foreground/90">{b.participantName}</span>
              <p className="font-medium text-amber-800/90 dark:text-amber-400/90">
                {b.requiredAction}
              </p>
              <p className="text-muted-foreground leading-relaxed">{b.explanation}</p>
              {b.resolutionRoute !== '#' ? (
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                  <Link href={b.resolutionRoute}>{b.ctaLabel ?? 'Review'}</Link>
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
