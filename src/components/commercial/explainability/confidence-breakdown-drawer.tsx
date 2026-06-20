'use client';

/**
 * Commercial Confidence Breakdown Drawer
 *
 * Explains the "Commercial Confidence" percentage.
 * Shows each revenue source's individual confidence score and factual reasons.
 * No AI prose. Only facts.
 */

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { deriveCommercialConfidenceBreakdown } from '@/lib/commercial/commercial-explainability';
import type { CommercialForecastResult } from '@/lib/commercial/commercial-forecast';
import { BreakdownEmptyState } from './breakdown-item-row';

export type ConfidenceBreakdownDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forecast: CommercialForecastResult;
  projectId?: string;
};

function ConfidenceMeter({ score }: { score: number }) {
  const label =
    score >= 80 ? 'High' :
    score >= 50 ? 'Medium' :
    score > 0   ? 'Low' :
    'No Data';

  const colorClass =
    score >= 80 ? 'bg-green-500' :
    score >= 50 ? 'bg-amber-500' :
    score > 0   ? 'bg-red-400' :
    'bg-muted';

  const textClass =
    score >= 80 ? 'text-green-700' :
    score >= 50 ? 'text-amber-600' :
    score > 0   ? 'text-red-600' :
    'text-muted-foreground';

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', colorClass)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn('text-sm font-bold tabular-nums w-12 text-right', textClass)}>
        {score}%
      </span>
      <span className={cn('text-xs font-medium w-14', textClass)}>{label}</span>
    </div>
  );
}

export function ConfidenceBreakdownDrawer({
  open,
  onOpenChange,
  forecast,
}: ConfidenceBreakdownDrawerProps) {
  const breakdown = React.useMemo(
    () => deriveCommercialConfidenceBreakdown(forecast),
    [forecast]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-base font-semibold">Commercial Confidence</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {breakdown.reason}
          </SheetDescription>
        </SheetHeader>

        {/* Overall score */}
        <div className="mb-5 rounded-lg border bg-muted/30 px-4 py-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Overall Confidence
          </p>
          <ConfidenceMeter score={breakdown.total} />
          <p className="text-xs text-muted-foreground">{breakdown.reason}</p>
        </div>

        {/* Per-source breakdown */}
        {breakdown.items.length === 0 ? (
          <BreakdownEmptyState
            title={breakdown.emptyStateReason ?? 'No data to show.'}
            checklist={breakdown.emptyStateChecklist}
          />
        ) : (
          <>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              By Revenue Source
            </p>
            <div className="space-y-4">
              {breakdown.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border bg-card px-4 py-3 space-y-2"
                >
                  {/* Name + amount */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {item.description}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.commercialStage}</p>
                    </div>
                  </div>

                  {/* Confidence meter */}
                  {item.confidence != null && (
                    <ConfidenceMeter score={item.confidence} />
                  )}

                  {/* Reasons — facts only, no AI prose */}
                  {item.confidenceReasons && item.confidenceReasons.length > 0 && (
                    <ul className="space-y-1 pt-1 border-t border-border/40">
                      {item.confidenceReasons.map((reason, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-1.5 text-[11px] text-muted-foreground"
                        >
                          <span
                            className={cn(
                              'text-xs font-bold shrink-0 mt-px',
                              reason.positive ? 'text-green-600' : 'text-red-500'
                            )}
                          >
                            {reason.positive ? '✓' : '✗'}
                          </span>
                          {reason.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
