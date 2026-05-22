'use client';

import * as React from 'react';
import type { OperationalGuidanceOptions } from '@/hooks/use-operational-guidance';
import { useOperationalGuidance } from '@/hooks/use-operational-guidance';
import { OperationalStateExplanation } from '@/components/operations/operational-state-explanation';
import { OperationalTrustStrip } from '@/components/operations/operational-trust-strip';
import { ReleaseConfidenceSummary } from '@/components/operations/release-confidence-summary';
import { ReleaseSimulationPreview } from '@/components/operations/release-simulation-preview';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

export type OperationalGuidanceRegionProps = OperationalGuidanceOptions & {
  title?: string;
  showExplanation?: boolean;
  showTrust?: boolean;
  showReleaseConfidence?: boolean;
  showSimulation?: boolean;
  className?: string;
};

/**
 * Progressive disclosure — calm summary first, details on expand.
 */
export function OperationalGuidanceRegion({
  showExplanation = false,
  showTrust = true,
  showReleaseConfidence = false,
  showSimulation = false,
  className,
  ...options
}: OperationalGuidanceRegionProps) {
  const { guidance } = useOperationalGuidance(options);

  return (
    <div className={cn('space-y-4', className)}>
      {showReleaseConfidence ? (
        <ReleaseConfidenceSummary confidence={guidance.releaseConfidence} compact />
      ) : null}

      {showSimulation ? (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground [&[data-state=open]>svg]:rotate-180">
            If released now
            <ChevronDown className="h-3.5 w-3.5 transition-transform" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <ReleaseSimulationPreview confidence={guidance.releaseConfidence} />
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {showTrust ? <OperationalTrustStrip signals={guidance.trustSignals} /> : null}

      {showExplanation && guidance.stateExplanation ? (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground [&[data-state=open]>svg]:rotate-180">
            Understand current status
            <ChevronDown className="h-3.5 w-3.5 transition-transform" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <OperationalStateExplanation explanation={guidance.stateExplanation} />
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}
