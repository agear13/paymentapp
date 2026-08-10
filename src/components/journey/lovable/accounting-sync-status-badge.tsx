'use client';

import { useMemo } from 'react';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import {
  accountingSyncDisplayLabel,
  resolveAccountingPushState,
  resolveAccountingSyncDisplayStatus,
  type AccountingInvoiceSyncRow,
} from '@/lib/accounting/accounting-push-state';
import { ACCOUNTING_INTEGRATION_COPY } from '@/lib/accounting/accounting-integration-copy';

type AccountingSyncStatusBadgeProps = {
  invoiceSync?: AccountingInvoiceSyncRow | null;
  linkUpdatedAt?: Date | string | null;
  link?: {
    amount: unknown;
    currency?: string | null;
    invoiceCurrency?: string | null;
    description?: string | null;
    customerEmail?: string | null;
    customerName?: string | null;
    invoiceReference?: string | null;
    invoiceDate?: Date | string | null;
    dueDate?: Date | string | null;
  } | null;
  className?: string;
};

export function AccountingSyncStatusBadge({
  invoiceSync,
  linkUpdatedAt,
  link,
  className = '',
}: AccountingSyncStatusBadgeProps) {
  const pushState = useMemo(
    () =>
      resolveAccountingPushState({
        invoiceSync,
        linkUpdatedAt,
        link,
      }),
    [invoiceSync, linkUpdatedAt, link]
  );

  const displayStatus = resolveAccountingSyncDisplayStatus(pushState);
  const label = accountingSyncDisplayLabel(displayStatus);

  const toneClass =
    displayStatus === 'synced'
      ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
      : displayStatus === 'local_changes'
        ? 'border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-300'
        : displayStatus === 'sync_failed'
          ? 'border-destructive/30 bg-destructive/5 text-destructive'
          : displayStatus === 'sync_pending'
            ? 'border-border bg-secondary/40 text-ink-soft'
            : 'border-border bg-secondary/30 text-ink-soft';

  const Icon =
    displayStatus === 'synced'
      ? Check
      : displayStatus === 'local_changes'
        ? AlertTriangle
        : displayStatus === 'sync_pending'
          ? Loader2
          : null;

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass} ${className}`}>
      <div className="flex items-center gap-2 text-[13px] font-medium">
        {Icon ? (
          <Icon
            className={`h-4 w-4 shrink-0 ${displayStatus === 'sync_pending' ? 'animate-spin' : ''}`}
            aria-hidden
          />
        ) : null}
        {displayStatus === 'synced' ? `✓ ${label}` : displayStatus === 'local_changes' ? `⚠ ${label}` : label}
      </div>
      {displayStatus === 'local_changes' ? (
        <p className="mt-1.5 text-[12.5px] opacity-90">
          {ACCOUNTING_INTEGRATION_COPY.localChangesNotSyncedBody}
        </p>
      ) : null}
    </div>
  );
}
