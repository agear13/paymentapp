'use client';

import { ChevronRight, Sparkles, Landmark } from 'lucide-react';
import { AccountingIntegrationNotice } from '@/components/journey/lovable/accounting-integration-notice';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import type { InvoiceAccountingDisplayState } from '@/lib/payment-links/invoice-detail-view-model';
import { invoiceAccountingStatusLabel } from '@/lib/payment-links/invoice-detail-view-model';

type InvoiceDetailSidebarProps = {
  displayRef: string;
  summaryRows: { label: string; value: string }[];
  paymentLinkId: string;
  accountingState: InvoiceAccountingDisplayState;
  accountingStatusLabel: string;
  onScrollToAccounting: () => void;
  aiDismissed: number[];
  onDismissAi: () => void;
};

function SidebarAccountingQuickPanel({
  accountingState,
  accountingStatusLabel,
  onScrollToAccounting,
}: {
  accountingState: InvoiceAccountingDisplayState;
  accountingStatusLabel: string;
  onScrollToAccounting: () => void;
}) {
  const needsAccountingAction =
    accountingState === 'local_changes' ||
    accountingState === 'not_synced' ||
    accountingState === 'sync_failed' ||
    accountingState === 'update_pending' ||
    accountingState === 'not_connected' ||
    accountingState === 'setup_incomplete';

  const statusToneClass =
    accountingState === 'synced'
      ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
      : accountingState === 'local_changes' || accountingState === 'sync_failed'
        ? 'border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-300'
        : accountingState === 'sync_pending'
          ? 'border-border bg-secondary/40 text-ink-soft'
          : 'border-border bg-secondary/30 text-ink-soft';

  const actionStatusText =
    accountingState === 'not_connected'
      ? invoiceAccountingStatusLabel('not_connected')
      : accountingState === 'setup_incomplete'
        ? invoiceAccountingStatusLabel('setup_incomplete')
        : accountingState === 'local_changes'
          ? 'Changes not synced'
          : accountingState === 'sync_failed'
            ? 'Sync failed'
            : accountingState === 'update_pending'
              ? 'Update pending'
              : accountingState === 'not_synced'
                ? 'Not synced'
                : null;

  return (
    <div className="space-y-3">
      <div className={`rounded-xl border px-4 py-3 ${statusToneClass}`}>
        <p className="text-[13px] font-medium">
          {accountingState === 'synced'
            ? `✓ ${accountingStatusLabel}`
            : accountingState === 'sync_pending'
              ? accountingStatusLabel
              : actionStatusText ?? accountingStatusLabel}
        </p>
        {needsAccountingAction ? (
          <button
            type="button"
            onClick={onScrollToAccounting}
            className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium underline-offset-2 hover:underline"
          >
            Go to Accounting section
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onScrollToAccounting}
        className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-soft transition-colors hover:text-foreground"
      >
        View accounting activity
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

export function InvoiceDetailSidebar({
  displayRef,
  summaryRows,
  paymentLinkId,
  accountingState,
  accountingStatusLabel,
  onScrollToAccounting,
  aiDismissed,
  onDismissAi,
}: InvoiceDetailSidebarProps) {
  return (
    <aside className="order-1 space-y-6 xl:sticky xl:top-8 xl:order-2 xl:self-start">
      <section
        aria-labelledby="ai-detail-heading"
        className="rounded-2xl border border-primary/25 bg-accent/20 p-6 shadow-card"
      >
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-purple text-primary-foreground">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <h2 id="ai-detail-heading" className="text-[13.5px] font-semibold">
            Provvy AI
          </h2>
        </div>
        <p className="mt-4 text-[12.5px] text-ink-soft">Analysis of {displayRef}</p>
        {aiDismissed.includes(0) ? null : (
          <div className="mt-4 rounded-xl border border-border bg-background/70 p-4">
            <p className="text-[13px] leading-relaxed text-ink-soft">
              Nothing needs your attention on this invoice.
            </p>
            <button
              type="button"
              onClick={onDismissAi}
              className="mt-3 text-[12px] text-ink-soft hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <h2 className="text-[13.5px] font-semibold">At a glance</h2>
        <dl className="mt-4 space-y-2.5">
          {summaryRows.map((r) => (
            <div key={r.label} className="flex justify-between gap-4 text-[13px]">
              <dt className="text-ink-soft">{r.label}</dt>
              <dd className="max-w-[60%] text-right font-medium">{r.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex items-center gap-2 text-[12px] text-ink-soft">
          <Landmark className="h-3.5 w-3.5" />
          Reconciles into your Commercial OS ledger
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-card">
        <h2 className="text-[13.5px] font-semibold">Accounting</h2>
        <AccountingIntegrationNotice returnTo={COMMERCIAL_OS_ROUTES.invoiceDetail(displayRef, { id: paymentLinkId })} />
        <SidebarAccountingQuickPanel
          accountingState={accountingState}
          accountingStatusLabel={accountingStatusLabel}
          onScrollToAccounting={onScrollToAccounting}
        />
      </section>
    </aside>
  );
}
