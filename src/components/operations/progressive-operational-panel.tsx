'use client';

import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { opTypeAction, opTypeBodySnug, opTypeLabel } from '@/lib/design/operational-typography';
import { opCollapsibleTrigger, opSurface } from '@/lib/design/operational-surfaces';
import { cn } from '@/lib/utils';

export type ProgressiveOperationalPanelProps = {
  title: string;
  summary: string;
  missingItems?: string[];
  detailLabel?: string;
  children?: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
};

export function ProgressiveOperationalPanel({
  title,
  summary,
  missingItems,
  detailLabel = 'Why does this matter?',
  children,
  className,
  defaultOpen = false,
}: ProgressiveOperationalPanelProps) {
  return (
    <section className={cn(opSurface('raised'), className)}>
      <div className="space-y-1.5">
        <h3 className={opTypeAction}>{title}</h3>
        <p className={opTypeBodySnug}>{summary}</p>
      </div>

      {missingItems && missingItems.length > 0 ? (
        <div className="mt-3">
          <p className={opTypeLabel}>Missing</p>
          <ul className="mt-1 space-y-0.5">
            {missingItems.map((item) => (
              <li key={item} className={cn(opTypeBodySnug, 'flex gap-2')}>
                <span className="text-foreground/50">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {children ? (
        <Collapsible defaultOpen={defaultOpen} className="mt-3">
          <CollapsibleTrigger className={opCollapsibleTrigger}>
            <span>{detailLabel}</span>
            <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200">
            {children}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </section>
  );
}
