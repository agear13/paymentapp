'use client';

import { AlertCircle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SettlementExplanation } from '@/lib/participant-portal/participant-portal-types';
import { cn } from '@/lib/utils';

type Props = {
  settlement: SettlementExplanation;
  className?: string;
};

export function SettlementExplanationCard({ settlement, className }: Props) {
  return (
    <Card
      className={cn(
        settlement.isBlocked && 'border-amber-200/80 bg-amber-50/30',
        className
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Settlement</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Current status
          </p>
          <p className="text-sm font-semibold mt-1">{settlement.statusLabel}</p>
        </div>

        {settlement.blockingReason ? (
          <div className="flex gap-2 rounded-lg border border-amber-200/60 bg-background/80 p-3">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-amber-800">
                Why payment is pending
              </p>
              <p className="text-sm text-amber-950 mt-0.5 leading-relaxed">
                {settlement.blockingReason}
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex gap-2 items-start">
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              What happens next
            </p>
            <p className="text-sm mt-0.5 leading-relaxed">{settlement.nextStep}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
