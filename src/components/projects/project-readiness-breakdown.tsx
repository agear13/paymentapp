'use client';

import Link from 'next/link';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { summarizeProjectReadinessGaps } from '@/lib/participants/participant-readiness';
import { hydrateParticipants, participantEntity } from '@/lib/operations/hydration/hydrate-participant';
import { formatParticipantPayoutReadiness } from '@/lib/projects/format-participant-payout-readiness';
import { deriveParticipantOperationalBlockers } from '@/lib/operations/blockers/payout-blockers';
import { Button } from '@/components/ui/button';

type ProjectReadinessBreakdownProps = {
  participants: DemoParticipant[];
  projectId?: string;
  className?: string;
};

export function ProjectReadinessBreakdown({
  participants,
  projectId,
  className,
}: ProjectReadinessBreakdownProps) {
  const safeList = hydrateParticipants(participants).map(participantEntity);
  const gaps = summarizeProjectReadinessGaps(safeList);

  if (gaps.total === 0) {
    return (
      <p className={className ?? 'text-sm text-muted-foreground'}>
        No participants added yet
      </p>
    );
  }

  const blockers = safeList.flatMap((p) => deriveParticipantOperationalBlockers(p, projectId));

  return (
    <div className={className ?? 'space-y-3'}>
      <p className="text-sm text-muted-foreground">
        {formatParticipantPayoutReadiness(gaps.payoutReadyCount, gaps.total)}
      </p>
      {gaps.gapLabels.length > 0 ? (
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground/80">Missing:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {gaps.gapLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {blockers.length > 0 ? (
        <ul className="space-y-3 text-xs border-t border-border/25 pt-2">
          {blockers.slice(0, 6).map((b) => (
            <li key={b.id} className="space-y-1">
              <span className="font-medium text-foreground/90">{b.participantName}</span>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Blocked by</p>
              <p className="font-medium text-amber-800/90 dark:text-amber-400/90">{b.requiredAction}</p>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground/80">Who must act:</span> {b.ownerLabel}
              </p>
              <p className="text-muted-foreground leading-relaxed">{b.explanation}</p>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground/80">Unlocks:</span> {b.unlocks}
              </p>
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
