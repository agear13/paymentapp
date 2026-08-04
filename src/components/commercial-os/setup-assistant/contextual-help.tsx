'use client';

import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type ContextualHelpProps = {
  label?: string;
  text: string;
};

/** Compact “What is this?” helper for setup sections. */
export function ContextualHelp({ label = 'What is this?', text }: ContextualHelpProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          aria-label={label}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-left leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
