'use client';

/**
 * Net Forecast Breakdown Drawer
 *
 * Explains the arithmetic behind "Net Forecast".
 * Shows Revenue − Obligations = Position, with every input line clickable.
 */

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatForecastAmount } from '@/lib/commercial/commercial-forecast';
import {
  deriveNetForecastBreakdown,
  type CommercialBreakdownItem,
} from '@/lib/commercial/commercial-explainability';
import type { CommercialForecastResult } from '@/lib/commercial/commercial-forecast';
import {
  BreakdownItemRow,
  BreakdownEmptyState,
} from './breakdown-item-row';
import { opSurfaceCritical, opSurfaceSuccess, opToneDanger, opToneSuccess } from '@/lib/design/operational-surfaces';

export type NetForecastBreakdownDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forecast: CommercialForecastResult;
  projectId?: string;
};

export function NetForecastBreakdownDrawer({
  open,
  onOpenChange,
  forecast,
  projectId,
}: NetForecastBreakdownDrawerProps) {
  const breakdown = React.useMemo(
    () => deriveNetForecastBreakdown(forecast),
    [forecast]
  );

  const isPositive = breakdown.netPosition >= 0;
  const isSurplus = breakdown.positionLabel === 'Surplus';
  const isDeficit = breakdown.positionLabel === 'Shortfall';

  const netAccentClass = isSurplus
    ? 'text-green-700'
    : isDeficit
      ? 'text-red-600'
      : 'text-foreground';

  const handleViewTimeline = React.useCallback((_item: CommercialBreakdownItem) => {
    if (projectId) {
      window.open(`/dashboard/projects/${projectId}?tab=timeline`, '_blank');
    }
  }, [projectId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-base font-semibold">Net Forecast</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {breakdown.reason}
          </SheetDescription>
        </SheetHeader>

        {/* Calculation summary */}
        <div className="mb-6 space-y-2">
          {/* Revenue row */}
          <div className={cn(opSurfaceSuccess, 'flex items-center justify-between px-4 py-3')}>
            <div className="flex items-center gap-2">
              <ArrowUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className={cn('text-sm font-medium', opToneSuccess)}>Revenue</span>
            </div>
            <span className={cn('text-sm font-bold tabular-nums', opToneSuccess)}>
              {formatForecastAmount(breakdown.revenue.total, breakdown.currency)}
            </span>
          </div>

          {/* Obligations row */}
          <div className={cn(opSurfaceCritical, 'flex items-center justify-between px-4 py-3')}>
            <div className="flex items-center gap-2">
              <ArrowDown className="h-4 w-4 text-red-500 dark:text-red-400" />
              <span className={cn('text-sm font-medium', opToneDanger)}>Committed Costs</span>
            </div>
            <span className={cn('text-sm font-bold tabular-nums', opToneDanger)}>
              − {formatForecastAmount(breakdown.obligations.total, breakdown.currency)}
            </span>
          </div>

          {/* Divider */}
          <div className="border-t border-dashed border-border/60 pt-2">
            <div className="flex items-center justify-between px-4 py-2">
              <div className="flex items-center gap-2">
                {isSurplus ? (
                  <ArrowUp className="h-4 w-4 text-green-600" />
                ) : isDeficit ? (
                  <ArrowDown className="h-4 w-4 text-red-500" />
                ) : (
                  <Minus className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm font-semibold text-foreground">
                  Forecast {breakdown.positionLabel}
                </span>
              </div>
              <span className={cn('text-base font-bold tabular-nums', netAccentClass)}>
                {isPositive ? '+' : ''}
                {formatForecastAmount(breakdown.netPosition, breakdown.currency)}
              </span>
            </div>
            <p className="px-4 text-xs text-muted-foreground">{breakdown.positionDescription}</p>
          </div>
        </div>

        {/* Revenue breakdown */}
        <div className="mb-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Revenue Sources
          </p>
          {breakdown.revenue.items.length === 0 ? (
            <BreakdownEmptyState
              title={breakdown.revenue.emptyStateReason ?? 'No revenue sources.'}
              checklist={breakdown.revenue.emptyStateChecklist}
            />
          ) : (
            <div className="divide-y rounded-lg border">
              {breakdown.revenue.items.map((item) => (
                <div key={item.id} className="px-3">
                  <BreakdownItemRow
                    item={item}
                    showConfidence
                    projectId={projectId}
                    onViewTimeline={handleViewTimeline}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Obligations breakdown */}
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Commitments
          </p>
          {breakdown.obligations.items.length === 0 ? (
            <BreakdownEmptyState
              title={breakdown.obligations.emptyStateReason ?? 'No commitments.'}
              checklist={breakdown.obligations.emptyStateChecklist}
            />
          ) : (
            <div className="divide-y rounded-lg border">
              {breakdown.obligations.items.map((item) => (
                <div key={item.id} className="px-3">
                  <BreakdownItemRow
                    item={item}
                    projectId={projectId}
                    onViewTimeline={handleViewTimeline}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
