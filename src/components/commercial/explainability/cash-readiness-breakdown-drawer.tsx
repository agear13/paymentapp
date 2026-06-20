'use client';

/**
 * Cash Readiness Breakdown Drawer
 *
 * Explains the "Cash Readiness" card.
 * Shows Available / Committed / Remaining with any blocking items.
 * The operator sees exactly why YES or NO — never just a word.
 */

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Check, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatForecastAmount } from '@/lib/commercial/commercial-forecast';
import { deriveCashReadinessBreakdown } from '@/lib/commercial/commercial-explainability';
import type { CommercialForecastResult } from '@/lib/commercial/commercial-forecast';
import { BreakdownEmptyState } from './breakdown-item-row';

export type CashReadinessBreakdownDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forecast: CommercialForecastResult;
  projectId?: string;
};

export function CashReadinessBreakdownDrawer({
  open,
  onOpenChange,
  forecast,
}: CashReadinessBreakdownDrawerProps) {
  const breakdown = React.useMemo(
    () => deriveCashReadinessBreakdown(forecast),
    [forecast]
  );

  const isReady = breakdown.canEveryoneBePaid;
  const isInsufficient = breakdown.emptyStateReason != null && breakdown.available.amount === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-base font-semibold">Cash Readiness</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {breakdown.reason}
          </SheetDescription>
        </SheetHeader>

        {isInsufficient ? (
          <BreakdownEmptyState title={breakdown.emptyStateReason ?? 'No data yet.'} />
        ) : (
          <>
            {/* Status banner */}
            <div
              className={cn(
                'mb-5 flex items-center gap-3 rounded-lg border px-4 py-3',
                isReady ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              )}
            >
              {isReady ? (
                <Check className="h-5 w-5 text-green-600 shrink-0" />
              ) : (
                <X className="h-5 w-5 text-red-500 shrink-0" />
              )}
              <div>
                <p className={cn('text-sm font-semibold', isReady ? 'text-green-800' : 'text-red-700')}>
                  {isReady ? 'All commitments can be paid' : 'Cannot pay all commitments'}
                </p>
                <p className={cn('text-xs', isReady ? 'text-green-700' : 'text-red-600')}>
                  {isReady ? 'Revenue covers all obligations.' : 'Additional revenue or funding is required.'}
                </p>
              </div>
            </div>

            {/* Three figures */}
            <div className="mb-5 grid grid-cols-3 gap-2">
              {[breakdown.available, breakdown.committed, breakdown.remaining].map((fig) => {
                const isRemaining = fig.label === 'Remaining';
                const isNegative = fig.amount < 0;
                return (
                  <div
                    key={fig.label}
                    className={cn(
                      'rounded-lg border px-3 py-2.5 text-center',
                      isRemaining && isNegative ? 'bg-red-50 border-red-200' :
                      isRemaining && !isNegative ? 'bg-green-50 border-green-200' :
                      'bg-muted/30 border-border/50'
                    )}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      {fig.label}
                    </p>
                    <p className={cn(
                      'text-sm font-bold tabular-nums',
                      isRemaining && isNegative ? 'text-red-600' :
                      isRemaining && !isNegative ? 'text-green-700' :
                      'text-foreground'
                    )}>
                      {(isRemaining && fig.amount > 0) ? '+' : ''}
                      {formatForecastAmount(fig.amount, fig.currency)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground leading-tight">
                      {fig.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Blockers */}
            {breakdown.blockers.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Blocking Items
                </p>
                <div className="space-y-2">
                  {breakdown.blockers.map((blocker, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5"
                    >
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-amber-800">{blocker.reason}</p>
                        <p className="text-xs text-amber-700 mt-0.5">{blocker.actionRequired}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No blockers — all clear */}
            {isReady && breakdown.blockers.length === 0 && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-center">
                <p className="text-sm text-green-700 font-medium">No blocking items</p>
                <p className="text-xs text-green-600 mt-0.5">
                  All commercial commitments are funded and ready for settlement.
                </p>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
