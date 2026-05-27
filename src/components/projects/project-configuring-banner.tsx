'use client';

import type { SafeParticipantRouteContext, SafeProjectRouteContext } from '@/lib/operations/routing/draft-safe-routing';
import { OperationalStatePill } from '@/components/operations/operational-state-pill';
import { cn } from '@/lib/utils';

export function ProjectConfiguringBanner({
  project,
  participants,
  className,
  onPrimaryAction,
  primaryLabel = 'Configure participant earnings',
}: {
  project: SafeProjectRouteContext;
  participants: SafeParticipantRouteContext;
  className?: string;
  onPrimaryAction?: () => void;
  primaryLabel?: string;
}) {
  if (!participants.showCompensationSetupGuidance) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border/60 bg-muted/20 px-4 py-4 space-y-3',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <OperationalStatePill phase={project.projectState} scope="project" />
        {participants.needsEarningsConfiguration ? (
          <span className="text-xs text-muted-foreground">Earnings setup in progress</span>
        ) : null}
      </div>
      <p className="text-sm font-medium">Configure how each participant gets paid</p>
      <p className="text-sm text-muted-foreground leading-relaxed">{project.guidance}</p>
      <p className="text-sm text-muted-foreground">{participants.guidance}</p>
      {participants.needsEarningsConfiguration && participants.total > 0 ? (
        <p className="text-xs text-muted-foreground">
          Open each participant&apos;s earnings structure below, or use the Earnings action on
          their row. This unlocks obligations and payout release when funding is ready.
        </p>
      ) : null}
      {onPrimaryAction && participants.total > 0 ? (
        <button
          type="button"
          className="text-sm font-medium text-primary underline-offset-2 hover:underline"
          onClick={onPrimaryAction}
        >
          {primaryLabel}
        </button>
      ) : null}
    </div>
  );
}
