'use client';

import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { StateExplanation } from '@/lib/operations/explainability';
import { cn } from '@/lib/utils';

export type OperationalStateExplanationProps = {
  explanation: StateExplanation | null;
  defaultOpen?: boolean;
  className?: string;
};

export function OperationalStateExplanation({
  explanation,
  defaultOpen = false,
  className,
}: OperationalStateExplanationProps) {
  if (!explanation) return null;

  return (
    <Collapsible defaultOpen={defaultOpen} className={cn('rounded-lg border bg-muted/20', className)}>
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/30 transition-colors [&[data-state=open]>svg]:rotate-180">
        <span>{explanation.title}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 space-y-4 text-sm">
        <ExplanationBlock label="What this means" text={explanation.whatThisMeans} />
        <ExplanationBlock label="Why it matters" text={explanation.whyItMatters} />
        <ExplanationBlock label="What unlocks next" text={explanation.whatUnlocksNext} />
        {explanation.blockingProgress.length > 0 ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
              What is blocking progress
            </p>
            <ul className="space-y-1 text-foreground/90">
              {explanation.blockingProgress.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ExplanationBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
        {label}
      </p>
      <p className="text-foreground/90 leading-relaxed">{text}</p>
    </div>
  );
}
