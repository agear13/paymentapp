'use client';

/**
 * Obligations Breakdown Drawer
 *
 * Explains the "Expected Obligations" card.
 * Every commitment is traced to its participant.
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
  deriveExpectedObligationsBreakdown,
  type CommercialBreakdownItem,
} from '@/lib/commercial/commercial-explainability';
import type { CommercialForecastResult } from '@/lib/commercial/commercial-forecast';
import {
  BreakdownItemRow,
  BreakdownEmptyState,
  BreakdownTotalRow,
} from './breakdown-item-row';

export type ObligationsBreakdownDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forecast: CommercialForecastResult;
  projectId?: string;
};

export function ObligationsBreakdownDrawer({
  open,
  onOpenChange,
  forecast,
  projectId,
}: ObligationsBreakdownDrawerProps) {
  const breakdown = React.useMemo(
    () => deriveExpectedObligationsBreakdown(forecast),
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
          <SheetTitle className="text-base font-semibold">Expected Obligations</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {breakdown.reason}
          </SheetDescription>
        </SheetHeader>

        {/* Total */}
        <div className="mb-4 rounded-lg border bg-muted/30 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Total Obligations
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
            {breakdown.total > 0
              ? formatForecastAmount(breakdown.total, breakdown.currency)
              : `${breakdown.currency} 0.00`}
          </p>
        </div>

        {/* Items */}
        {breakdown.items.length === 0 ? (
          <BreakdownEmptyState
            title={breakdown.emptyStateReason ?? 'No obligations yet.'}
            checklist={breakdown.emptyStateChecklist}
          />
        ) : (
          <>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Commitments
            </p>
            <div className="divide-y">
              {breakdown.items.map((item) => (
                <BreakdownItemRow
                  key={item.id}
                  item={item}
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
