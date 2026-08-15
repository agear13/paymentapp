'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { useCommercialReadinessOptional } from '@/hooks/use-commercial-readiness';
import { ACCOUNTING_INTEGRATION_COPY } from '@/lib/accounting/accounting-integration-copy';
import { ConnectAccountingModal } from '@/components/journey/lovable/connect-accounting-modal';
import { merchantCreateInvoicePaymentLabel } from '@/components/journey/lovable/create-invoice-ui';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import type { CommercialDealDraft } from '@/lib/commercial-os/commercial-deal-draft';
import { INVOICE_PAYMENT_METHOD_CUSTOMER_CHOICE_LABEL } from '@/lib/payment-links/payment-collection-mode';
import type { PaymentMethod } from '@prisma/client';

type CreateInvoicePreviewSidebarProps = {
  draft: CommercialDealDraft;
  previewAmount: string;
  hasPreviewAmount: boolean;
  paymentMethodLabel?: string;
  loading?: boolean;
};

export function CreateInvoicePreviewSidebar({
  draft,
  previewAmount,
  hasPreviewAmount,
  paymentMethodLabel,
  loading = false,
}: CreateInvoicePreviewSidebarProps) {
  const readiness = useCommercialReadinessOptional();
  const [accountingModalOpen, setAccountingModalOpen] = useState(false);

  const connected = readiness?.connection.connected ?? false;
  const syncReady = readiness?.canSyncToAccounting ?? readiness?.canCreateInvoice ?? false;
  const showAccountingCta = readiness && !readiness.loading && !syncReady;

  const collectionMode = draft.paymentCollectionMode ?? 'single';
  const payLabel =
    paymentMethodLabel ??
    (collectionMode === 'invoice_only'
      ? 'Invoice only'
      : collectionMode === 'customer_choice'
        ? INVOICE_PAYMENT_METHOD_CUSTOMER_CHOICE_LABEL
        : draft.paymentMethod
          ? merchantCreateInvoicePaymentLabel(draft.paymentMethod as PaymentMethod).title
          : null);

  return (
    <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
          Live preview
        </div>
        {loading ? (
          <div className="mt-4 animate-pulse space-y-3">
            <div className="h-4 w-full rounded bg-secondary" />
            <div className="h-4 w-2/3 rounded bg-secondary" />
            <div className="h-8 w-1/2 rounded bg-secondary" />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div>
              <div className="text-[11px] text-ink-soft">Customer</div>
              <div className="text-[14px] font-medium">
                {draft.customerName.trim() || draft.customerEmail.trim() || (
                  <span className="text-ink-soft">Add customer details</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-ink-soft">Description</div>
              <div className="text-[14px]">
                {draft.description.trim() || (
                  <span className="text-ink-soft">Add a description</span>
                )}
              </div>
            </div>
            {draft.invoiceReference.trim() ? (
              <div>
                <div className="text-[11px] text-ink-soft">Reference</div>
                <div className="text-[14px] font-medium">{draft.invoiceReference.trim()}</div>
              </div>
            ) : null}
            <div className="flex items-end justify-between gap-3 border-t border-border pt-3">
              <div>
                <div className="text-[11px] text-ink-soft">Total due</div>
                <div
                  className={`text-2xl font-semibold tracking-tight ${
                    hasPreviewAmount ? '' : 'text-ink-soft'
                  }`}
                >
                  {previewAmount}
                </div>
              </div>
              {draft.dueDate ? (
                <div className="text-right text-[12px] text-ink-soft">
                  Due {format(draft.dueDate, 'd MMM yyyy')}
                </div>
              ) : null}
            </div>
            {payLabel ? (
              <div className="text-[12px] text-ink-soft">
                {collectionMode === 'invoice_only'
                  ? 'No online payment'
                  : collectionMode === 'customer_choice'
                    ? payLabel
                    : `Pay via ${payLabel}`}
              </div>
            ) : (
              <div className="text-[12px] text-ink-soft">Choose how your customer will pay</div>
            )}
          </div>
        )}
      </div>

      {showAccountingCta ? (
        <div className="rounded-xl border border-border bg-secondary/30 p-4">
          <p className="text-[13px] font-medium">
            {connected
              ? ACCOUNTING_INTEGRATION_COPY.setupIncompleteStatus
              : ACCOUNTING_INTEGRATION_COPY.notConnectedStatus}
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">
            {ACCOUNTING_INTEGRATION_COPY.notConnectedDescription}
          </p>
          {!connected ? (
            <button
              type="button"
              onClick={() => setAccountingModalOpen(true)}
              className="mt-3 inline-flex items-center rounded-xl border border-border bg-background px-3.5 py-2 text-[12.5px] font-semibold transition-colors hover:bg-secondary"
            >
              {ACCOUNTING_INTEGRATION_COPY.connectCta}
            </button>
          ) : null}
        </div>
      ) : null}

      <ConnectAccountingModal
        open={accountingModalOpen}
        onOpenChange={setAccountingModalOpen}
        continueFrom={COMMERCIAL_OS_ROUTES.createInvoice}
      />
    </aside>
  );
}
