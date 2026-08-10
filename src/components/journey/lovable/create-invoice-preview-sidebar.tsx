'use client';

import { format } from 'date-fns';
import { Sparkles } from 'lucide-react';
import { AccountingIntegrationNotice } from '@/components/journey/lovable/accounting-integration-notice';
import { PaymentsCheckPill } from '@/components/journey/lovable/payments-settlement-ui';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import type { CommercialDealDraft } from '@/lib/commercial-os/commercial-deal-draft';
import type { buildInvoicePaymentMethodOptions } from '@/lib/payment-links/setup-status';
import { usePaymentsSettlementReadiness } from '@/hooks/use-payments-settlement-readiness';

type ConnectedSystemCard = {
  name: string;
  detail: string;
};

type CreateInvoicePreviewSidebarProps = {
  draft: CommercialDealDraft;
  previewAmount: string;
  guidance: string;
  paymentMethodOptions: ReturnType<typeof buildInvoicePaymentMethodOptions>;
  connectedSystems: ConnectedSystemCard[] | null;
  loading?: boolean;
};

export function CreateInvoicePreviewSidebar({
  draft,
  previewAmount,
  guidance,
  paymentMethodOptions,
  connectedSystems,
  loading = false,
}: CreateInvoicePreviewSidebarProps) {
  const { readiness, loading: readinessLoading } = usePaymentsSettlementReadiness();

  return (
    <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
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
                <div className="text-2xl font-semibold tracking-tight">{previewAmount}</div>
              </div>
              {draft.dueDate ? (
                <div className="text-right text-[12px] text-ink-soft">
                  Due {format(draft.dueDate, 'd MMM yyyy')}
                </div>
              ) : null}
            </div>
            {draft.paymentMethod ? (
              <div className="text-[12px] text-ink-soft">
                Pay via{' '}
                {paymentMethodOptions.find((o) => o.value === draft.paymentMethod)?.label ??
                  draft.paymentMethod}
              </div>
            ) : (
              <div className="text-[12px] text-ink-soft">Choose a payment method</div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-primary/20 bg-card p-5 shadow-card">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-purple text-primary-foreground shadow-glow">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="text-[14px] font-semibold tracking-tight">Provvy AI</div>
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-foreground">{guidance}</p>
      </div>

      {!readinessLoading && !readiness.requiredDone ? (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            Commercial readiness
          </div>
          <p className="mt-2 text-[12.5px] text-ink-soft">
            {readiness.doneCount} of {readiness.checklist.length} setup steps complete before
            end-to-end collection.
          </p>
          <ul className="mt-3 space-y-1.5">
            {readiness.checklist
              .filter((item) => !item.optional && !item.done)
              .slice(0, 3)
              .map((item) => (
                <PaymentsCheckPill key={item.id} done={false}>
                  {item.label}
                </PaymentsCheckPill>
              ))}
          </ul>
        </div>
      ) : null}

      <AccountingIntegrationNotice returnTo={COMMERCIAL_OS_ROUTES.createInvoice} />

      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
          Connected systems
        </div>
        {connectedSystems === null ? (
          <p className="mt-3 text-[12.5px] text-ink-soft">Loading connections…</p>
        ) : connectedSystems.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {connectedSystems.map((sys) => (
              <li key={sys.name} className="flex items-center justify-between text-[13px]">
                <span className="font-medium">{sys.name}</span>
                <span className="text-ink-soft">{sys.detail}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">
            No payment or accounting connections yet. You can still invoice with manual bank or
            crypto once configured in Payments &amp; Settlement.
          </p>
        )}
      </div>
    </aside>
  );
}
