'use client';

import { Button } from '@/components/ui/button';
import type { ExistingPromoterRelationship } from '@/lib/workflows/referral-management/promoter-duplicate';

export function ExistingPromoterDuplicateCard({
  existing,
  onOpenExisting,
  onSearchPromoters,
}: {
  existing: ExistingPromoterRelationship;
  onOpenExisting: () => void;
  onSearchPromoters: () => void;
}) {
  return (
    <div
      className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
      data-testid="existing-promoter-duplicate-card"
    >
      <p className="text-[13px] font-semibold">Existing relationship found</p>
      <dl className="space-y-1 text-[13px]">
        <div className="flex gap-2">
          <dt className="text-ink-soft">Name:</dt>
          <dd className="font-medium">{existing.name}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-ink-soft">Email:</dt>
          <dd>{existing.email}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-ink-soft">Role/type:</dt>
          <dd>{existing.role}</dd>
        </div>
        {existing.statusLabel ? (
          <div className="flex gap-2">
            <dt className="text-ink-soft">Status:</dt>
            <dd>{existing.statusLabel}</dd>
          </div>
        ) : null}
        {existing.compensationLabel || existing.serviceSummary ? (
          <div className="flex gap-2">
            <dt className="text-ink-soft">Commission:</dt>
            <dd>
              {[existing.compensationLabel, existing.serviceSummary].filter(Boolean).join(' · ')}
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onOpenExisting}>
          Open existing relationship →
        </Button>
        <Button type="button" variant="outline" onClick={onSearchPromoters}>
          Search promoters
        </Button>
      </div>
    </div>
  );
}
