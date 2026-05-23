'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OPERATOR_PAYOUT_DISCLAIMER } from '@/lib/operations/merchant-operational-copy';
import { opSurface } from '@/lib/design/operational-surfaces';
import { cn } from '@/lib/utils';

type OperatorPayoutVerificationInfoProps = {
  className?: string;
  collapsible?: boolean;
};

export function OperatorPayoutVerificationInfo({
  className,
  collapsible = true,
}: OperatorPayoutVerificationInfoProps) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div
      className={cn(
        opSurface('inset'),
        'px-3 py-2.5 text-sm space-y-1',
        className
      )}
    >
      <div className="flex items-start gap-2">
        <Info className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium text-foreground/90">Operator payout verification</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {OPERATOR_PAYOUT_DISCLAIMER.split('.')[0]}.
          </p>
          {expanded ? (
            <p className="text-xs text-muted-foreground leading-relaxed pt-1">
              Operators are responsible for collecting required payout, tax, and identity details
              according to local regulations before making payouts.
            </p>
          ) : null}
        </div>
        {collapsible ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <>
                Less
                <ChevronUp className="ml-1 h-3 w-3" />
              </>
            ) : (
              <>
                Learn more
                <ChevronDown className="ml-1 h-3 w-3" />
              </>
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
