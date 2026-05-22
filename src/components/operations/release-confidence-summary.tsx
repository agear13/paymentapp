'use client';

import type { ReleaseConfidenceSnapshot } from '@/lib/operations/explainability';
import {
  CONFIDENCE_HEADLINES,
  labelSafeToRelease,
  OPERATOR_LABELS,
} from '@/lib/operations/design-language';
import { formatTreasuryAmount } from '@/lib/projects/funding-sources/format-funding-source';
import { OperationalStatePill } from '@/components/operations/operational-state-pill';
import { ProgressiveOperationalPanel } from '@/components/operations/progressive-operational-panel';
import {
  opTypeBodySnug,
  opTypeLabel,
  opTypeMetric,
  opTypeMeta,
  opTypeSection,
} from '@/lib/design/operational-typography';
import { opDivider } from '@/lib/design/operational-surfaces';
import { cn } from '@/lib/utils';

export type ReleaseConfidenceSummaryProps = {
  confidence: ReleaseConfidenceSnapshot;
  className?: string;
  compact?: boolean;
  calmMode?: boolean;
};

export function ReleaseConfidenceSummary({
  confidence,
  className,
  compact,
  calmMode,
}: ReleaseConfidenceSummaryProps) {
  const fmt = (n: number) => formatTreasuryAmount(n, confidence.currency);
  const blocked = confidence.level === 'BLOCKED';
  const heldReasons = confidence.heldBackReasons.slice(0, compact ? 2 : 4);

  if (compact || calmMode) {
    return (
      <div className={cn('space-y-2', className)} aria-label="Safe to release">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div>
            <p className={opTypeLabel}>{OPERATOR_LABELS.safeToRelease}</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">
              {labelSafeToRelease(confidence.level)}
            </p>
          </div>
          <OperationalStatePill
            phase={
              blocked
                ? 'BLOCKED'
                : confidence.level === 'HIGH'
                  ? 'READY_FOR_RELEASE'
                  : 'FUNDING_PENDING'
            }
            scope="project"
          />
        </div>
        {heldReasons.length > 0 ? (
          <ProgressiveOperationalPanel
            title={blocked ? OPERATOR_LABELS.releaseBlocked : 'Held back'}
            summary={CONFIDENCE_HEADLINES[confidence.level]}
            missingItems={heldReasons}
          >
            <p className={opTypeBodySnug}>
              {confidence.explainability.bullets[0] ??
                'Complete participant earnings and confirm funding before releasing payouts.'}
            </p>
          </ProgressiveOperationalPanel>
        ) : (
          <p className={opTypeBodySnug}>{CONFIDENCE_HEADLINES[confidence.level]}</p>
        )}
      </div>
    );
  }

  return (
    <section className={cn('space-y-3', className)} aria-label="Safe to release">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div>
          <h3 className={opTypeSection}>{OPERATOR_LABELS.safeToRelease}</h3>
          <p className={cn(opTypeBodySnug, 'mt-0.5 max-w-xl')}>
            {CONFIDENCE_HEADLINES[confidence.level]}
          </p>
        </div>
        <OperationalStatePill
          phase={
            blocked
              ? 'BLOCKED'
              : confidence.level === 'HIGH'
                ? 'READY_FOR_RELEASE'
                : 'FUNDING_PENDING'
          }
          scope="project"
        />
      </div>

      <dl className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm border-t pt-3', opDivider)}>
        <div>
          <dt className={opTypeMeta}>Releasable now</dt>
          <dd className={cn(opTypeMetric, 'mt-0.5 text-lg')}>{fmt(confidence.readyToRelease)}</dd>
        </div>
        <div>
          <dt className={opTypeMeta}>Held back</dt>
          <dd className={cn(opTypeMetric, 'mt-0.5 text-lg')}>{fmt(confidence.heldBack)}</dd>
        </div>
        <div>
          <dt className={opTypeMeta}>Collected revenue</dt>
          <dd className={cn(opTypeMetric, 'mt-0.5 text-lg')}>{fmt(confidence.collectedRevenue)}</dd>
        </div>
        <div>
          <dt className={opTypeMeta}>Assessment</dt>
          <dd className={cn(opTypeMetric, 'mt-0.5 text-lg')}>
            {labelSafeToRelease(confidence.level)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
