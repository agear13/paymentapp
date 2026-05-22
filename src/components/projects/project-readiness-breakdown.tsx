'use client';

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  deriveParticipantReadiness,
  summarizeProjectReadinessGaps,
} from '@/lib/participants/participant-readiness';
import { normalizeParticipant } from '@/lib/operational/safe-operational-hydration';
import { formatParticipantPayoutReadiness } from '@/lib/projects/format-participant-payout-readiness';

type ProjectReadinessBreakdownProps = {
  participants: DemoParticipant[];
  className?: string;
};

export function ProjectReadinessBreakdown({
  participants,
  className,
}: ProjectReadinessBreakdownProps) {
  const safeList = participants.map(normalizeParticipant);
  const gaps = summarizeProjectReadinessGaps(safeList);

  if (gaps.total === 0) {
    return (
      <p className={className ?? 'text-sm text-muted-foreground'}>
        No participants added yet
      </p>
    );
  }

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
      {gaps.payoutReadyCount < gaps.total ? (
        <ul className="space-y-1.5 text-xs border-t border-border/25 pt-2">
          {participants
            .map((p) => deriveParticipantReadiness(p))
            .filter((r) => !r.isPayoutReady && r.primaryIssue)
            .slice(0, 6)
            .map((r) => (
              <li key={r.participantId} className="flex flex-col">
                <span className="font-medium text-foreground/90">{r.name}</span>
                <span className="text-amber-700/90 dark:text-amber-400/90">
                  ⚠ {r.primaryIssue}
                </span>
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}
