'use client';

import { format } from 'date-fns';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import {
  accountingStatusBadgeClass,
  accountingStatusLabel,
} from '@/lib/treasury/accounting/accounting-status';
import type {
  AccountingDisplayStatus,
  TreasuryAccountingLifecycleStage,
  TreasuryAccountingView,
} from '@/lib/treasury/accounting/types';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

function Badge({ status }: { status: AccountingDisplayStatus }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${accountingStatusBadgeClass(status)}`}
    >
      {accountingStatusLabel(status)}
    </span>
  );
}

function TreasuryStatusBadge({ status }: { status: string }) {
  const cls =
    status === 'CONFIRMED'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'INFERRED'
        ? 'bg-amber-100 text-amber-800'
        : status === 'EXCEPTION'
          ? 'bg-red-100 text-red-800'
          : 'bg-secondary text-ink-soft';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>{status}</span>
  );
}

function StageRow({ stage }: { stage: TreasuryAccountingLifecycleStage }) {
  const amountLabel =
    stage.eventType === 'CONVERSION'
      ? `${stage.amount ?? '—'} → ${stage.destinationAmount ?? '—'} ${stage.destinationAsset ?? 'AUD'}`
      : stage.amount
        ? `${stage.amount} ${stage.asset ?? ''}`.trim()
        : null;

  return (
    <div className="rounded-xl border border-border/80 bg-secondary/10 p-4 text-[13px]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium">{stage.label}</div>
          {amountLabel ? (
            <div className="mt-1 font-mono text-[12px] text-ink-soft">{amountLabel}</div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge status={stage.accountingStatus} />
          <TreasuryStatusBadge status={stage.treasuryStatus} />
        </div>
      </div>
      <div className="mt-2 grid gap-1 text-[11px] text-ink-soft">
        {stage.provider ? <div>Provider: {stage.provider.replaceAll('_', ' ')}</div> : null}
        {stage.occurredAt ? (
          <div>When: {format(new Date(stage.occurredAt), 'dd MMM yyyy HH:mm')}</div>
        ) : null}
        {stage.transactionReference ? (
          <div className="font-mono">Tx: {stage.transactionReference}</div>
        ) : null}
        {stage.feeAmount ? <div>Fee: {stage.feeAmount}</div> : null}
        {stage.exchangeRate ? <div>Rate: {stage.exchangeRate}</div> : null}
        {stage.evidence ? (
          <div>
            Evidence: {stage.evidence.manual ? 'Manual link' : (stage.evidence.strategy ?? 'Linked')}
            {stage.evidence.linkStatus ? ` (${stage.evidence.linkStatus})` : ''}
          </div>
        ) : null}
        {stage.manualReconciliation ? (
          <div className="text-emerald-800">
            Manually reconciled by {stage.manualReconciliation.linkedByUserId} at{' '}
            {format(new Date(stage.manualReconciliation.linkedAt), 'dd MMM yyyy HH:mm')}
            {stage.manualReconciliation.notes
              ? ` — ${stage.manualReconciliation.notes}`
              : ''}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type TreasuryAccountingDetailPanelProps = {
  view: TreasuryAccountingView;
  onClose?: () => void;
};

export function TreasuryAccountingDetailPanel({ view, onClose }: TreasuryAccountingDetailPanelProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {view.invoiceReference ?? 'Invoice'} — Treasury Accounting
          </h2>
          <p className="mt-1 text-[13px] text-ink-soft">
            Overall status:{' '}
            <span className="font-medium capitalize">{view.chainStatus.replaceAll('_', ' ').toLowerCase()}</span>
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-3 py-1.5 text-[12px]"
          >
            Back to list
          </button>
        ) : null}
        {view.invoiceReference ? (
          <Link
            href={COMMERCIAL_OS_ROUTES.invoiceDetail(view.invoiceReference, {
              id: view.paymentLinkId,
            })}
            className="text-[12px] text-accent-foreground underline"
          >
            Open invoice
          </Link>
        ) : null}
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="text-[14px] font-semibold">Revenue</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
          <Badge status={view.revenue.accountingStatus} />
          <span>
            {view.revenue.accountingAmount ?? view.revenue.invoiceAmount}{' '}
            {view.revenue.accountingCurrency ?? view.revenue.invoiceCurrency}
          </span>
          {view.revenue.revenueAccountCode ? (
            <span className="text-ink-soft">Revenue account {view.revenue.revenueAccountCode}</span>
          ) : null}
        </div>
        <div className="mt-2 text-[12px] text-ink-soft">
          Xero invoice: {view.revenue.xeroInvoiceSyncStatus ?? 'Not synced'}
          {view.revenue.xeroInvoiceId ? ` · ${view.revenue.xeroInvoiceId}` : ''}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="text-[14px] font-semibold">Customer payment</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
          <Badge status={view.customerPayment.accountingStatus} />
          {view.customerPayment.treasuryStatus ? (
            <TreasuryStatusBadge status={view.customerPayment.treasuryStatus} />
          ) : null}
          <span>
            {view.customerPayment.asset ?? view.customerPayment.paymentRail}{' '}
            {view.customerPayment.paymentAmount
              ? `· ${view.customerPayment.paymentAmount} ${view.customerPayment.paymentCurrency ?? ''}`
              : ''}
          </span>
        </div>
        <div className="mt-2 space-y-1 text-[12px] text-ink-soft">
          <div>
            Xero payment: {view.customerPayment.xeroPaymentSyncStatus ?? 'Not synced'}
            {view.customerPayment.xeroPaymentId ? ` · ${view.customerPayment.xeroPaymentId}` : ''}
          </div>
          {view.customerPayment.holdingAccountCode ? (
            <div>
              Holding account: {view.customerPayment.holdingAccountCode}
              {view.customerPayment.holdingAccountName
                ? ` (${view.customerPayment.holdingAccountName})`
                : ''}
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-[14px] font-semibold">Treasury lifecycle</h3>
        <p className="text-[12px] text-ink-soft">
          Observational treasury events are not posted to Xero unless shown as Posted above.
        </p>
        {view.lifecycleStages.length === 0 ? (
          <p className="text-[13px] text-ink-soft">No treasury lifecycle events recorded yet.</p>
        ) : (
          view.lifecycleStages.map((stage) => (
            <StageRow key={`${stage.stage}-${stage.eventId ?? stage.label}`} stage={stage} />
          ))
        )}
      </section>

      {view.exceptions.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 text-[12px]">
          <h3 className="font-semibold text-amber-900">Requires attention</h3>
          <ul className="mt-2 space-y-2">
            {view.exceptions.map((ex) => (
              <li key={`${ex.type}-${ex.observed}`}>
                <span className="font-medium capitalize">{ex.type.replaceAll('_', ' ')}</span>
                {' — '}
                {ex.reason}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-secondary/20 p-4 text-[12px] text-ink-soft">
        <h3 className="font-semibold text-foreground">Accounting notes</h3>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {view.explanations.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
