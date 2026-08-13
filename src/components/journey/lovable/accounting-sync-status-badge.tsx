'use client';

import { AlertTriangle, Check, Landmark, Loader2 } from 'lucide-react';
import { ACCOUNTING_INTEGRATION_COPY } from '@/lib/accounting/accounting-integration-copy';
import type { InvoiceAccountingDisplayState } from '@/lib/payment-links/invoice-detail-view-model';
import { invoiceAccountingStatusLabel } from '@/lib/payment-links/invoice-detail-view-model';

type AccountingSyncStatusBadgeProps = {
  accountingState: InvoiceAccountingDisplayState;
  className?: string;
};

export function AccountingSyncStatusBadge({
  accountingState,
  className = '',
}: AccountingSyncStatusBadgeProps) {
  const label = invoiceAccountingStatusLabel(accountingState);

  if (accountingState === 'not_connected') {
    return (
      <div
        className={`rounded-xl border border-border bg-secondary/30 px-4 py-3 ${className}`}
        role="status"
      >
        <div className="flex items-center gap-2 text-[13px] font-medium text-ink-soft">
          <Landmark className="h-4 w-4 shrink-0" aria-hidden />
          {label}
        </div>
        <p className="mt-1.5 text-[12.5px] text-ink-soft">
          {ACCOUNTING_INTEGRATION_COPY.notConnectedDescription}
        </p>
      </div>
    );
  }

  const toneClass =
    accountingState === 'synced'
      ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
      : accountingState === 'local_changes'
        ? 'border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-300'
        : accountingState === 'sync_failed'
          ? 'border-destructive/30 bg-destructive/5 text-destructive'
          : accountingState === 'sync_pending'
            ? 'border-border bg-secondary/40 text-ink-soft'
            : 'border-border bg-secondary/30 text-ink-soft';

  const Icon =
    accountingState === 'synced'
      ? Check
      : accountingState === 'local_changes'
        ? AlertTriangle
        : accountingState === 'sync_pending'
          ? Loader2
          : null;

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass} ${className}`}>
      <div className="flex items-center gap-2 text-[13px] font-medium">
        {Icon ? (
          <Icon
            className={`h-4 w-4 shrink-0 ${accountingState === 'sync_pending' ? 'animate-spin' : ''}`}
            aria-hidden
          />
        ) : null}
        {accountingState === 'synced'
          ? `✓ ${label}`
          : accountingState === 'local_changes'
            ? `⚠ ${label}`
            : label}
      </div>
      {accountingState === 'local_changes' ? (
        <p className="mt-1.5 text-[12.5px] opacity-90">
          {ACCOUNTING_INTEGRATION_COPY.localChangesNotSyncedBody}
        </p>
      ) : null}
      {accountingState === 'setup_incomplete' ? (
        <p className="mt-1.5 text-[12.5px] opacity-90">
          Finish account mapping before pushing invoices to your accounting software.
        </p>
      ) : null}
    </div>
  );
}
