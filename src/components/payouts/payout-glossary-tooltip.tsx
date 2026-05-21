'use client';

import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { PAYOUT_GLOSSARY, type PayoutGlossaryTerm } from '@/lib/payouts/payout-glossary';
import { cn } from '@/lib/utils';

export function PayoutGlossaryTooltip({
  term,
  label,
  className,
}: {
  term: PayoutGlossaryTerm;
  label?: string;
  className?: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-1 text-muted-foreground hover:text-foreground',
              className
            )}
            aria-label={`What is ${label ?? term}?`}
          >
            {label ? <span>{label}</span> : null}
            <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-sm">{PAYOUT_GLOSSARY[term]}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
