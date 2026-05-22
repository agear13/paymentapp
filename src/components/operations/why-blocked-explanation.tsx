'use client';

import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { opTypeBodySnug, opTypeLabel, opTypeMeta } from '@/lib/design/operational-typography';
import { opCollapsibleTrigger } from '@/lib/design/operational-surfaces';
import { cn } from '@/lib/utils';

export type WhyBlockedExplanationProps = {
  whyBlocked: string;
  whatUnlocks: string;
  recommendedStep?: string;
  defaultOpen?: boolean;
  className?: string;
};

export function WhyBlockedExplanation({
  whyBlocked,
  whatUnlocks,
  recommendedStep,
  defaultOpen = false,
  className,
}: WhyBlockedExplanationProps) {
  return (
    <Collapsible defaultOpen={defaultOpen} className={cn('text-sm', className)}>
      <CollapsibleTrigger className={opCollapsibleTrigger}>
        <span className="underline-offset-2 hover:underline">Why is this blocked?</span>
        <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2.5 space-y-2.5 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200">
        <div>
          <p className={opTypeLabel}>Why blocked</p>
          <p className={cn(opTypeBodySnug, 'mt-1')}>{whyBlocked}</p>
        </div>
        <div>
          <p className={opTypeLabel}>What unlocks this</p>
          <p className={cn(opTypeBodySnug, 'mt-1')}>{whatUnlocks}</p>
        </div>
        {recommendedStep ? (
          <div>
            <p className={opTypeLabel}>Next step</p>
            <p className={cn(opTypeMeta, 'mt-1')}>{recommendedStep}</p>
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}
