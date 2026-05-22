'use client';

import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
      <CollapsibleTrigger className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors [&[data-state=open]>svg]:rotate-180">
        <span className="underline-offset-2 hover:underline">Why is this blocked?</span>
        <ChevronDown className="h-3.5 w-3.5 transition-transform" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 space-y-3 text-foreground/90">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Why blocked</p>
          <p>{whyBlocked}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">What unlocks this</p>
          <p>{whatUnlocks}</p>
        </div>
        {recommendedStep ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Recommended next step</p>
            <p>{recommendedStep}</p>
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}
