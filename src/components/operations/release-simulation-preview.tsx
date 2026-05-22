'use client';

import type { ReleaseConfidenceSnapshot } from '@/lib/operations/explainability';
import { formatTreasuryAmount } from '@/lib/projects/funding-sources/format-funding-source';
import { CONFIDENCE_HEADLINES } from '@/lib/operations/design-language';
import { cn } from '@/lib/utils';

export type ReleaseSimulationPreviewProps = {
  confidence: ReleaseConfidenceSnapshot;
  pendingInvoices?: number;
  unreconciledSources?: number;
  className?: string;
};

/**
 * Presentation-only “if released now” preview — no payout execution.
 */
export function ReleaseSimulationPreview({
  confidence,
  pendingInvoices = 0,
  unreconciledSources = 0,
  className,
}: ReleaseSimulationPreviewProps) {
  const fmt = (n: number) => formatTreasuryAmount(n, confidence.currency);

  return (
    <div className={cn('space-y-3 text-sm', className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        If released now
      </p>
      <ul className="space-y-1.5 text-foreground/90">
        <li>· {fmt(confidence.readyToRelease)} releasable</li>
        <li>· {fmt(confidence.heldBack)} held back</li>
        {confidence.blockedParticipantCount > 0 ? (
          <li>
            · {confidence.blockedParticipantCount} blocked participant
            {confidence.blockedParticipantCount === 1 ? '' : 's'}
          </li>
        ) : null}
        {pendingInvoices > 0 ? (
          <li>
            · {pendingInvoices} pending invoice{pendingInvoices === 1 ? '' : 's'}
          </li>
        ) : null}
        {unreconciledSources > 0 ? (
          <li>
            · {unreconciledSources} unreconciled revenue source
            {unreconciledSources === 1 ? '' : 's'}
          </li>
        ) : null}
      </ul>
      <div className="pt-2 border-t border-border/50">
        <p className="text-xs font-medium text-muted-foreground mb-1">Safe release assessment</p>
        <p className="text-muted-foreground leading-relaxed">
          {CONFIDENCE_HEADLINES[confidence.level]}
        </p>
      </div>
    </div>
  );
}
