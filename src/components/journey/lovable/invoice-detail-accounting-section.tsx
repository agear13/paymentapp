'use client';

import { format } from 'date-fns';
import { CommercialOsNextStepBanner } from '@/components/journey/lovable/commercial-os-next-step-banner';
import { AccountingActivityTimeline } from '@/components/journey/lovable/accounting-activity-timeline';
import { AccountingPushAction } from '@/components/journey/lovable/accounting-push-action';
import { AccountingSyncStatusBadge } from '@/components/journey/lovable/accounting-sync-status-badge';
import { InvoiceDetailExpandableCard, InvoiceDetailField, InvoiceDetailSectionHeading } from '@/components/journey/lovable/invoice-detail-ui';
import { ACCOUNTING_INTEGRATION_COPY } from '@/lib/accounting/accounting-integration-copy';
import type { AccountingInvoiceSyncRow } from '@/lib/accounting/accounting-push-state';
import { shouldShowPaidVoidWarning } from '@/lib/accounting/accounting-removal-ux';
import { formatCurrency } from '@/lib/formatters/format-currency';
import type { InvoiceAccountingDisplayState } from '@/lib/payment-links/invoice-detail-view-model';
import { getXeroSyncDisplayStatus } from '@/lib/xero/xero-sync-display';
import type { PaymentLinkDetails } from '@/components/payment-links/payment-link-detail-dialog';

type AccountingLinkSnapshot = {
  amount: unknown;
  currency?: string | null;
  invoiceCurrency?: string | null;
  description?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  invoiceReference?: string | null;
  invoiceDate?: Date | string | null;
  dueDate?: Date | string | null;
};

type InvoiceDetailAccountingSectionProps = {
  detail: PaymentLinkDetails;
  paymentLinkId: string;
  invoiceSync: AccountingInvoiceSyncRow | null;
  linkSnapshot: AccountingLinkSnapshot;
  accountingState: InvoiceAccountingDisplayState;
  accountingGuidance: {
    tone: 'default' | 'success' | 'info';
    title: string;
    message: string;
  };
  showAccountingSyncDetails: boolean;
  xeroDisplay: { label: string; dotClass: string } | null;
  showFx: boolean;
  creationFx: PaymentLinkDetails['fxSnapshots'];
  settlementFx: PaymentLinkDetails['fxSnapshots'];
  ledgerEntries: NonNullable<PaymentLinkDetails['ledgerEntries']>;
  onQueued: () => void;
};

export function InvoiceDetailAccountingSection({
  detail,
  paymentLinkId,
  invoiceSync,
  linkSnapshot,
  accountingState,
  accountingGuidance,
  showAccountingSyncDetails,
  xeroDisplay,
  showFx,
  creationFx,
  settlementFx,
  ledgerEntries,
  onQueued,
}: InvoiceDetailAccountingSectionProps) {
  const showAdvancedAudit = showFx || ledgerEntries.length > 0;

  return (
    <div id="accounting-section" className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <InvoiceDetailSectionHeading
          eyebrow="Accounting"
          title="Accounting synchronisation"
          description="Push or update this invoice in your accounting software when you choose — Provvy never overwrites accounting records automatically."
        />

        <div className="space-y-4">
          <AccountingSyncStatusBadge accountingState={accountingState} />

          {accountingState !== 'not_connected' ? (
            <AccountingPushAction
              paymentLinkId={paymentLinkId}
              invoiceSync={invoiceSync}
              linkUpdatedAt={detail.updatedAt}
              link={linkSnapshot}
              onQueued={onQueued}
            />
          ) : null}

          {accountingState !== 'not_connected' && accountingGuidance.title !== accountingGuidance.message ? (
            <CommercialOsNextStepBanner
              tone={accountingGuidance.tone}
              title={accountingGuidance.title}
              message={accountingGuidance.message}
            />
          ) : null}

          {shouldShowPaidVoidWarning({ status: detail.status, xeroSyncs: detail.xeroSyncs }) ? (
            <CommercialOsNextStepBanner
              tone="info"
              title={ACCOUNTING_INTEGRATION_COPY.paidInvoiceFutureNoticeTitle}
              message={(() => {
                const [lead, ...rest] =
                  ACCOUNTING_INTEGRATION_COPY.paidInvoiceFutureNoticeBody.split('\n\n');
                return (
                  <>
                    <p>{lead}</p>
                    {rest.length > 0 ? <p className="mt-2">{rest.join('\n\n')}</p> : null}
                  </>
                );
              })()}
            />
          ) : null}
        </div>
      </section>

      {showAccountingSyncDetails ? (
        <AccountingActivityTimeline syncs={detail.xeroSyncs} />
      ) : null}

      {showAccountingSyncDetails && (detail.xeroSyncs?.length ?? 0) > 0 ? (
        <InvoiceDetailExpandableCard title="Sync records" summary={xeroDisplay?.label ?? 'Sync status'}>
          <div className="space-y-6">
            {xeroDisplay ? (
              <div className="flex items-center gap-2 text-[13.5px] font-medium">
                <span className={`h-1.5 w-1.5 rounded-full ${xeroDisplay.dotClass}`} />
                {xeroDisplay.label}
              </div>
            ) : null}
            {detail.xeroInvoiceNumber ? (
              <InvoiceDetailField label="Xero invoice" value={detail.xeroInvoiceNumber} />
            ) : null}
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                Sync history
              </div>
              <ul className="mt-3 space-y-2 text-[12.5px] text-ink-soft">
                {detail.xeroSyncs!.map((sync) => {
                  const display = getXeroSyncDisplayStatus(sync, detail.xeroSyncs ?? []);
                  return (
                    <li key={sync.id} className="flex justify-between gap-4">
                      <span>
                        {sync.syncType} · {display.label}
                      </span>
                      <span>
                        {format(new Date(sync.updatedAt || sync.createdAt), 'd MMM · HH:mm')}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </InvoiceDetailExpandableCard>
      ) : null}

      {showAdvancedAudit ? (
        <InvoiceDetailExpandableCard title="Advanced / audit" summary="Ledger, FX and technical details">
          <div className="space-y-6">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                Ledger entries
              </div>
              {ledgerEntries.length > 0 ? (
                <ul className="mt-3 space-y-3">
                  {ledgerEntries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3"
                    >
                      <div>
                        <div className="text-[13px] font-medium">
                          {entry.ledgerAccount?.name ?? 'Account'} ({entry.ledgerAccount?.code ?? '—'})
                        </div>
                        <div className="text-[12px] text-ink-soft">{entry.description}</div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-[13px] font-medium ${
                            entry.entryType === 'DEBIT' ? 'text-destructive' : 'text-emerald-600'
                          }`}
                        >
                          {entry.entryType === 'DEBIT' ? 'DR' : 'CR'}{' '}
                          {formatCurrency(Number(entry.amount), entry.currency)}
                        </div>
                        <div className="text-[11px] text-ink-soft">
                          {format(new Date(entry.createdAt), 'd MMM · HH:mm')}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[13px] text-ink-soft">
                  No ledger entries yet — entries appear after payment reconciliation.
                </p>
              )}
            </div>

            {showFx ? (
              <div className="space-y-6 border-t border-border pt-6">
                {(creationFx?.length ?? 0) > 0 ? (
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                      FX at creation
                    </div>
                    <ul className="mt-3 space-y-2 text-[12.5px]">
                      {creationFx!.map((snap) => (
                        <li key={snap.id} className="flex justify-between gap-4">
                          <span>
                            1 {snap.baseCurrency} = {snap.rate.toFixed(6)} {snap.quoteCurrency}
                          </span>
                          <span className="text-ink-soft">
                            {format(new Date(snap.capturedAt), 'd MMM · HH:mm')} · {snap.provider}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {(settlementFx?.length ?? 0) > 0 ? (
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                      FX at settlement
                    </div>
                    <ul className="mt-3 space-y-2 text-[12.5px]">
                      {settlementFx!.map((snap) => (
                        <li key={snap.id} className="flex justify-between gap-4">
                          <span>
                            1 {snap.baseCurrency} = {snap.rate.toFixed(6)} {snap.quoteCurrency}
                          </span>
                          <span className="text-ink-soft">
                            {format(new Date(snap.capturedAt), 'd MMM · HH:mm')} · {snap.provider}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </InvoiceDetailExpandableCard>
      ) : null}
    </div>
  );
}
