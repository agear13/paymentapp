'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const FULL_LIFECYCLE = [
  'Customer payment creates a payout obligation',
  'Funding and approval clear the amount for release',
  'Release batch sends the participant payout',
  'Participant payouts remain traceable after release',
] as const;

export function PayoutHowItWorksCard() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-1.5 pt-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <span className="text-foreground font-medium">Payment</span>
        <ChevronRight className="h-3 w-3 opacity-40" aria-hidden />
        <span className="text-foreground font-medium">Funding</span>
        <ChevronRight className="h-3 w-3 opacity-40" aria-hidden />
        <span className="text-foreground font-medium">Release</span>
        <Button
          variant="link"
          size="sm"
          className="h-auto px-0 py-0 text-xs text-muted-foreground"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Hide' : 'View full payout lifecycle'}
        </Button>
      </div>
      {expanded ? (
        <ul
          className={cn(
            'text-xs text-muted-foreground/90 space-y-1 max-w-md',
            'animate-in fade-in-0 duration-200'
          )}
        >
          {FULL_LIFECYCLE.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** @deprecated */
export function PayoutLifecycleFlow() {
  return null;
}
