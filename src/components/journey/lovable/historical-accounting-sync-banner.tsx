'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useCommercialReadinessOptional } from '@/hooks/use-commercial-readiness';
import { ACCOUNTING_INTEGRATION_COPY } from '@/lib/accounting/accounting-integration-copy';
import { historicalSyncBannerMessage } from '@/lib/accounting/historical-accounting-sync';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

function dismissStorageKey(organizationId: string): string {
  return `provvy.historicalAccountingSyncBannerDismissed.${organizationId}`;
}

type HistoricalAccountingSyncBannerProps = {
  organizationId: string;
};

export function HistoricalAccountingSyncBanner({ organizationId }: HistoricalAccountingSyncBannerProps) {
  const readiness = useCommercialReadinessOptional();
  const [dismissed, setDismissed] = useState(true);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(dismissStorageKey(organizationId)) === '1');
    } catch {
      setDismissed(false);
    }
  }, [organizationId]);

  const loadPreview = useCallback(async () => {
    if (!organizationId || !(readiness?.canSyncToAccounting ?? readiness?.canCreateInvoice)) {
      setCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/xero/sync/historical?organization_id=${encodeURIComponent(organizationId)}`,
        { cache: 'no-store' }
      );
      if (!res.ok) {
        setCount(0);
        return;
      }
      const body = (await res.json()) as { totalUnsynced?: number };
      setCount(body.totalUnsynced ?? 0);
    } catch {
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [organizationId, readiness?.canCreateInvoice, readiness?.canSyncToAccounting]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(dismissStorageKey(organizationId), '1');
    } catch {
      /* ignore */
    }
  };

  const syncAll = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/xero/sync/historical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, syncAll: true }),
      });
      const body = (await res.json()) as { error?: string; queued?: number };
      if (!res.ok) {
        toast.error(body.error ?? 'Failed to queue sync');
        return;
      }
      toast.success(ACCOUNTING_INTEGRATION_COPY.historicalSyncQueuedToast);
      setCount(0);
      dismiss();
      void readiness?.refresh();
    } catch {
      toast.error('Failed to queue sync');
    } finally {
      setSyncing(false);
    }
  };

  if (
    loading ||
    dismissed ||
    count === 0 ||
    !(readiness?.canSyncToAccounting ?? readiness?.canCreateInvoice)
  ) {
    return null;
  }

  return (
    <div className="relative mb-6 rounded-2xl border border-primary/20 bg-accent/50 p-5 pr-12 shadow-card">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-lg p-1.5 text-ink-soft transition-colors hover:bg-background hover:text-foreground"
        aria-label={ACCOUNTING_INTEGRATION_COPY.historicalSyncDismiss}
      >
        <X className="h-4 w-4" />
      </button>
      <div className="text-[14px] font-semibold text-foreground">
        {historicalSyncBannerMessage(count)}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void syncAll()}
          disabled={syncing}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-purple px-4 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-glow transition-all hover:brightness-110 disabled:opacity-60"
        >
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {ACCOUNTING_INTEGRATION_COPY.historicalSyncSyncAll}
        </button>
        <Link
          href={COMMERCIAL_OS_ROUTES.historicalAccountingSync}
          className="inline-flex items-center rounded-xl border border-border px-4 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-secondary"
        >
          {ACCOUNTING_INTEGRATION_COPY.historicalSyncReview}
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex items-center rounded-xl px-3 py-2.5 text-[13px] font-medium text-ink-soft transition-colors hover:text-foreground"
        >
          {ACCOUNTING_INTEGRATION_COPY.historicalSyncDismiss}
        </button>
      </div>
    </div>
  );
}
