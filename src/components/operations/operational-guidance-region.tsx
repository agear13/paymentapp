'use client';

import * as React from 'react';
import type { OperationalCoordinationStateOptions } from '@/hooks/use-operational-coordination-state';
import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import { ReleaseConfidenceSummary } from '@/components/operations/release-confidence-summary';
import { opCollapsibleTrigger } from '@/lib/design/operational-surfaces';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

export type OperationalGuidanceRegionProps = OperationalCoordinationStateOptions & {
  title?: string;
  showExplanation?: boolean;
  showTrust?: boolean;
  showReleaseConfidence?: boolean;
  showSimulation?: boolean;
  className?: string;
};

/** Progressive disclosure — calm summary first, details on expand. */
export function OperationalGuidanceRegion({
  showReleaseConfidence = false,
  showSimulation = false,
  className,
  ...options
}: OperationalGuidanceRegionProps) {
  const { guidance } = useOperationalCoordinationState({
    ...options,
    traceSurface: options.traceSurface ?? 'operational-guidance-region',
  });

  if (!showReleaseConfidence && !showSimulation) return null;

  return (
    <div className={cn('space-y-3', className)}>
      {showReleaseConfidence ? (
        <ReleaseConfidenceSummary confidence={guidance.releaseConfidence} compact calmMode />
      ) : null}

      {showSimulation ? (
        <Collapsible>
          <CollapsibleTrigger className={opCollapsibleTrigger}>
            If released now
            <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 data-[state=open]:animate-in data-[state=closed]:animate-out duration-200">
            <p className="text-sm text-foreground/75">
              {guidance.releaseConfidence.explainability.headline}
            </p>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}
