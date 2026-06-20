'use client';

/**
 * Revenue Breakdown Drawer
 *
 * Explains the "Expected Revenue" card.
 * Every revenue source is traced to its origin: invoice, forecast, or revenue source.
 */

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { formatForecastAmount } from '@/lib/commercial/commercial-forecast';
import {
  deriveExpectedRevenueBreakdown,
  type CommercialBreakdownItem,
} from '@/lib/commercial/commercial-explainability';
import type { CommercialForecastResult } from '@/lib/commercial/commercial-forecast';
import {
  BreakdownItemRow,
  BreakdownEmptyState,
  BreakdownTotalRow,
} from './breakdown-item-row';

export type RevenueBreakdownDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forecast: CommercialForecastResult;
  projectId?: string;
};

export function RevenueBreakdownDrawer({
  open,
  onOpenChange,
  forecast,
  projectId,
}: RevenueBreakdownDrawerProps) {
  const breakdown = React.useMemo(
    () => deriveExpectedRevenueBreakdown(forecast),
    [forecast]
  );

  const handleViewTimeline = React.useCallback((_item: CommercialBreakdownItem) => {
    if (projectId) {
      window.open(`/dashboard/projects/${projectId}?tab=timeline`, '_blank');
    }
  }, [projectId]);

  const handleViewLedger = React.useCallback((_item: CommercialBreakdownItem) => {
    window.open('/dashboard/ledger', '_blank');
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-base font-semibold">Expected Revenue</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {breakdown.reason}
          </SheetDescription>
        </SheetHeader>

        {/* Total */}
        <div className="mb-4 rounded-lg border bg-muted/30 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Total Expected Revenue
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
            {breakdown.total > 0
              ? formatForecastAmount(breakdown.total, breakdown.currency)
              : `${breakdown.currency} 0.00`}
          </p>
          {breakdown.confidence != null && breakdown.total > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {breakdown.confidence}% confidence
            </p>
          )}
        </div>

        {/* Items */}
        {breakdown.items.length === 0 ? (
          <BreakdownEmptyState
            title={breakdown.emptyStateReason ?? 'No revenue sources yet.'}
            checklist={breakdown.emptyStateChecklist}
          />
        ) : (
          <>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sources
            </p>
            <div className="divide-y">
              {breakdown.items.map((item) => (
                <BreakdownItemRow
                  key={item.id}
                  item={item}
                  showConfidence
                  projectId={projectId}
                  onViewTimeline={handleViewTimeline}
                  onViewLedger={handleViewLedger}
                />
              ))}
            </div>
            <Separator className="my-2" />
            <BreakdownTotalRow
              amount={breakdown.total}
              currency={breakdown.currency}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
