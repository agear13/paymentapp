'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useCommercialReadinessOptional } from '@/hooks/use-commercial-readiness';
import { ACCOUNTING_INTEGRATION_COPY } from '@/lib/accounting/accounting-integration-copy';
import type { HistoricalSyncItem } from '@/lib/accounting/historical-accounting-sync';
import {
  INVOICE_DISPLAY_STATUS_CLS,
  toInvoiceDisplayStatus,
} from '@/lib/payment-links/invoice-display-status';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

type HistoricalAccountingSyncReviewScreenProps = {
  organizationId: string;
};

function formatRowDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, 'd MMM yyyy');
}

export function HistoricalAccountingSyncReviewScreen({
  organizationId,
}: HistoricalAccountingSyncReviewScreenProps) {
  const readiness = useCommercialReadinessOptional();
  const [items, setItems] = useState<HistoricalSyncItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/xero/sync/historical?organization_id=${encodeURIComponent(organizationId)}`,
        { cache: 'no-store' }
      );
      const body = (await res.json()) as {
        error?: string;
        items?: HistoricalSyncItem[];
      };
      if (!res.ok) {
        setLoadError(body.error ?? 'Unable to load unsynced invoices');
        setItems([]);
        return;
      }
      const nextItems = body.items ?? [];
      setItems(nextItems);
      setSelectedIds(new Set(nextItems.map((item) => item.paymentLinkId)));
    } catch {
      setLoadError('Unable to load unsynced invoices');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const allSelected = useMemo(
    () => items.length > 0 && selectedIds.size === items.length,
    [items.length, selectedIds.size]
  );

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(items.map((item) => item.paymentLinkId)));
  };

  const toggleOne = (paymentLinkId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(paymentLinkId)) next.delete(paymentLinkId);
      else next.add(paymentLinkId);
      return next;
    });
  };

  const runSync = async (syncAll: boolean) => {
    const paymentLinkIds = syncAll ? undefined : Array.from(selectedIds);
    if (!syncAll && (!paymentLinkIds || paymentLinkIds.length === 0)) {
      toast.error('Select at least one invoice to sync');
      return;
    }

    setSyncing(true);
    try {
      const res = await fetch('/api/xero/sync/historical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          syncAll,
          paymentLinkIds,
        }),
      });
      const body = (await res.json()) as { error?: string; queued?: number };
      if (!res.ok) {
        toast.error(body.error ?? 'Failed to queue sync');
        return;
      }
      toast.success(ACCOUNTING_INTEGRATION_COPY.historicalSyncQueuedToast);
      void readiness?.refresh();
      await loadPreview();
    } catch {
      toast.error('Failed to queue sync');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={COMMERCIAL_OS_ROUTES.connectedXero}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to accounting
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
          {ACCOUNTING_INTEGRATION_COPY.historicalSyncReviewTitle}
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] text-ink-soft">
          {ACCOUNTING_INTEGRATION_COPY.historicalSyncReviewSubtitle}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void runSync(true)}
          disabled={syncing || items.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-purple px-4 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-glow transition-all hover:brightness-110 disabled:opacity-60"
        >
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {ACCOUNTING_INTEGRATION_COPY.historicalSyncSyncEverything}
        </button>
        <button
          type="button"
          onClick={() => void runSync(false)}
          disabled={syncing || selectedIds.size === 0}
          className="inline-flex items-center rounded-xl border border-border px-4 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
        >
          {ACCOUNTING_INTEGRATION_COPY.historicalSyncSyncSelected}
          {selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
        </button>
        <button
          type="button"
          onClick={() => void loadPreview()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium text-ink-soft transition-colors hover:text-foreground"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="bg-secondary/40 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-5 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all invoices"
                    className="h-4 w-4 rounded border-border"
                  />
                </th>
                <th className="px-5 py-3">Invoice</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Sync status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-ink-soft">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <p className="text-[14px] font-medium text-foreground">{loadError}</p>
                    <button
                      type="button"
                      onClick={() => void loadPreview()}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-secondary"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Try again
                    </button>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <p className="text-[14px] font-medium text-foreground">
                      {ACCOUNTING_INTEGRATION_COPY.historicalSyncEmptyTitle}
                    </p>
                    <p className="mt-2 text-[13px] text-ink-soft">
                      {ACCOUNTING_INTEGRATION_COPY.historicalSyncEmptyBody}
                    </p>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const displayStatus = toInvoiceDisplayStatus({ status: item.status });
                  return (
                    <tr
                      key={item.paymentLinkId}
                      className="border-t border-border/70 transition-colors hover:bg-secondary/40"
                    >
                      <td className="px-5 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.paymentLinkId)}
                          onChange={() => toggleOne(item.paymentLinkId)}
                          aria-label={`Select invoice ${item.invoiceNumber}`}
                          className="h-4 w-4 rounded border-border"
                        />
                      </td>
                      <td className="px-5 py-4 font-medium">{item.invoiceNumber}</td>
                      <td className="px-5 py-4">{item.customer ?? '—'}</td>
                      <td className="px-5 py-4 text-ink-soft">{formatRowDate(item.date)}</td>
                      <td className="px-5 py-4 font-medium">{item.amount}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${INVOICE_DISPLAY_STATUS_CLS[displayStatus]}`}
                        >
                          {displayStatus}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-ink-soft">{item.syncStatus}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
