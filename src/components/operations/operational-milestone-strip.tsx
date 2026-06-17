'use client';

import { cn } from '@/lib/utils';
import type { OnboardingMilestoneProjection } from '@/lib/operations/timeline/types';
import type { OperationalConfidenceScore } from '@/lib/operations/timeline/types';

export type OperationalMilestoneStripProps = {
  milestones: OnboardingMilestoneProjection[];
  confidence?: OperationalConfidenceScore;
  className?: string;
  maxItems?: number;
};

/** Lightweight milestone + confidence strip for initialization and payout surfaces. */
export function OperationalMilestoneStrip({
  milestones,
  confidence,
  className,
  maxItems = 6,
}: OperationalMilestoneStripProps) {
  const display = milestones.slice(0, maxItems);

  if (display.length === 0 && !confidence) return null;

  return (
    <div className={cn('space-y-3', className)}>
      {confidence ? (
        <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2">
          <p className="text-xs font-medium text-foreground">{confidence.explainability.headline}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {confidence.coveragePercent}% business milestones verified
            {confidence.level !== 'BLOCKED' ? ` · ${confidence.level} business readiness` : ''}
          </p>
        </div>
      ) : null}

      {display.length > 0 ? (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {display.map((milestone) => (
            <li
              key={milestone.id}
              className={cn(
                'text-xs',
                milestone.complete ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {milestone.complete ? '✓' : '○'} {milestone.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
