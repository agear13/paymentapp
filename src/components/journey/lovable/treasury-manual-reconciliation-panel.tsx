'use client';

import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { ManualReconciliationReviewItem } from '@/lib/treasury/reconciliation/manual-link-review';
import { TreasuryManualReconciliationDialog } from '@/components/journey/lovable/treasury-manual-reconciliation-dialog';

type TreasuryManualReconciliationPanelProps = {
  organizationId: string | null;
  visible: boolean;
  onLinked: () => void;
};

export function TreasuryManualReconciliationPanel({
  organizationId,
  visible,
  onLinked,
}: TreasuryManualReconciliationPanelProps) {
  const [items, setItems] = useState<ManualReconciliationReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeItem, setActiveItem] = useState<ManualReconciliationReviewItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId || !visible) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/treasury/manual-link/review?organizationId=${encodeURIComponent(organizationId)}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as { items: ManualReconciliationReviewItem[] };
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [organizationId, visible]);

  useEffect(() => {
    void load();
  }, [load]);

  const openReview = (item: ManualReconciliationReviewItem) => {
    setActiveItem(item);
    setDialogOpen(true);
  };

  const handleLinked = () => {
    onLinked();
    void load();
  };

  if (!visible) return null;

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">Needs manual reconciliation</h2>
            <p className="mt-1 text-[13px] text-ink-soft">
              Resolve exceptions Provvy could not link automatically. Amount, timestamp, and token
              matching are never used.
            </p>
          </div>
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-ink-soft" /> : null}
        </div>

        {loading ? null : items.length === 0 ? (
          <p className="mt-4 text-[13px] text-ink-soft">
            No manual reconciliation items in this view.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {items.map((item) => (
              <li
                key={item.reviewId}
                className="rounded-xl border border-border/80 bg-secondary/10 p-4 text-[13px]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium capitalize">
                      {item.exception.type.replaceAll('_', ' ')}
                      {item.invoiceReference ? ` · ${item.invoiceReference}` : ''}
                    </div>
                    <p className="mt-1 text-ink-soft">{item.exception.observed}</p>
                    <p className="mt-1 text-[12px] text-ink-soft">{item.exception.reason}</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-xl bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-foreground"
                    onClick={() => openReview(item)}
                  >
                    Review &amp; link
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {organizationId ? (
        <TreasuryManualReconciliationDialog
          organizationId={organizationId}
          item={activeItem}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onLinked={handleLinked}
        />
      ) : null}
    </>
  );
}
