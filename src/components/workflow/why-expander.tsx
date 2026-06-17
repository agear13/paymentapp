'use client';

/**
 * WhyExpander — universal "Why?" reasoning expander.
 *
 * Every recommendation in Provvypay should explain itself.
 * This is the single shared implementation of that concept.
 *
 * Previously, a local ReasoningExpander existed in project-page-copilot.tsx.
 * This replaces it and is the canonical component.
 *
 * Usage:
 *   <WhyExpander reasoning={decision.reasoning} />
 *
 * Rendering:
 *   [Why?]              ← collapsed by default
 *   Provvy analysed your business.
 *   This recommendation is ranked highest because:
 *   • customer payments are currently blocked
 *   • participant setup is complete
 *   • connecting a payment provider unlocks revenue immediately
 */

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type WhyExpanderProps = {
  /** Array of reasoning bullet points from CommercialDecisionResult.reasoning */
  reasoning: string[];
  /** Optional custom label instead of "Why?" */
  label?: string;
  /** Optional preamble — "Provvy analysed your business. This recommendation is ranked highest because:" */
  preamble?: string;
  className?: string;
};

/**
 * Universal reasoning expander.
 *
 * Collapsed by default — operators who understand the recommendation skip it.
 * Available for anyone who wants to understand why Provvy chose this action.
 */
export function WhyExpander({
  reasoning,
  label = 'Why?',
  preamble,
  className,
}: WhyExpanderProps) {
  const [open, setOpen] = React.useState(false);

  if (reasoning.length === 0) return null;

  const defaultPreamble =
    preamble ??
    "I'm recommending this because:";

  return (
    <div className={cn('mt-1', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={open}
      >
        {label}
        <ChevronDown
          className={cn('h-3 w-3 transition-transform duration-200', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="mt-2 rounded-lg border border-border/30 bg-muted/20 px-3 py-2.5 space-y-2">
          <p className="text-xs text-muted-foreground leading-snug">{defaultPreamble}</p>
          <ul className="space-y-1">
            {reasoning.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <span className="mt-0.5 shrink-0 text-border/70">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
