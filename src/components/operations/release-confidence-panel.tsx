'use client';

import type { ReleaseConfidenceSnapshot } from '@/lib/operations/explainability';
import { ReleaseConfidenceSummary } from '@/components/operations/release-confidence-summary';

/** @deprecated Prefer ReleaseConfidenceSummary */
export function ReleaseConfidencePanel({
  confidence,
  title,
  className,
}: {
  confidence: ReleaseConfidenceSnapshot;
  title?: string;
  className?: string;
}) {
  return (
    <ReleaseConfidenceSummary
      confidence={confidence}
      className={className}
    />
  );
}
