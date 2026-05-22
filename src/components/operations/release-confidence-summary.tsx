'use client';

import type { ReleaseConfidenceSnapshot } from '@/lib/operations/explainability';
import {
  CONFIDENCE_HEADLINES,
  labelSafeToRelease,
  OPERATOR_LABELS,
} from '@/lib/operations/design-language';
import { formatTreasuryAmount } from '@/lib/projects/funding-sources/format-funding-source';
import { OperationalStatePill } from '@/components/operations/operational-state-pill';
import { WhyBlockedExplanation } from '@/components/operations/why-blocked-explanation';
import { cn } from '@/lib/utils';

export type ReleaseConfidenceSummaryProps = {
  confidence: ReleaseConfidenceSnapshot;
  className?: string;
  compact?: boolean;
};

export function ReleaseConfidenceSummary({
  confidence,
  className,
  compact,
}: ReleaseConfidenceSummaryProps) {
  const fmt = (n: number) => formatTreasuryAmount(n, confidence.currency);
  const blocked = confidence.level === 'BLOCKED';

  return (
    <section className={cn('space-y-4', className)} aria-label="Safe to release">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div>
          <h3 className="text-sm font-semibold">{OPERATOR_LABELS.safeToRelease}</h3>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-xl">
            {CONFIDENCE_HEADLINES[confidence.level]}
          </p>
        </div>
        <OperationalStatePill
          phase={blocked ? 'BLOCKED' : confidence.level === 'HIGH' ? 'READY_FOR_RELEASE' : 'FUNDING_PENDING'}
          scope="project"
        />
      </div>

      {!compact ? (
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm border-t border-border/50 pt-4">
          <div>
            <dt className="text-xs text-muted-foreground">Releasable now</dt>
            <dd className="font-medium mt-0.5">{fmt(confidence.readyToRelease)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Held back</dt>
            <dd className="font-medium mt-0.5">{fmt(confidence.heldBack)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Collected revenue</dt>
            <dd className="font-medium mt-0.5">{fmt(confidence.collectedRevenue)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Assessment</dt>
            <dd className="font-medium mt-0.5">{labelSafeToRelease(confidence.level)}</dd>
          </div>
        </dl>
      ) : null}

      {confidence.heldBackReasons.length > 0 ? (
        <ul className="text-sm space-y-1 text-muted-foreground">
          {confidence.heldBackReasons.map((r) => (
            <li key={r}>· {r}</li>
          ))}
        </ul>
      ) : null}

      {blocked || confidence.level === 'LOW' ? (
        <WhyBlockedExplanation
          whyBlocked={
            confidence.explainability.bullets[0] ??
            'Critical setup items are incomplete.'
          }
          whatUnlocks="Complete participant payout setup and confirm funding before releasing payouts."
          recommendedStep={confidence.riskWarnings[0]}
        />
      ) : null}
    </section>
  );
}
