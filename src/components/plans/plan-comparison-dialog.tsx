'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PlanComparison } from '@/components/plans/plan-comparison';
import type { PlanCatalogId } from '@/lib/plans/plan-catalog';
import { useEntitlements } from '@/hooks/use-entitlements';

type PlanComparisonDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  highlightPlan?: PlanCatalogId;
};

export function PlanComparisonDialog({
  open,
  onOpenChange,
  highlightPlan,
}: PlanComparisonDialogProps) {
  const { plan } = useEntitlements();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-6xl max-h-[min(90vh,960px)] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Compare plans</DialogTitle>
          <DialogDescription>
            Choose the plan that matches how your business coordinates commerce.
          </DialogDescription>
        </DialogHeader>
        <PlanComparison highlightPlan={highlightPlan} currentPlan={plan ?? undefined} />
      </DialogContent>
    </Dialog>
  );
}
