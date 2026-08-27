'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Copy, FileText, Send } from 'lucide-react';
import { AccountingFirstInvoiceBanner } from '@/components/journey/lovable/accounting-first-invoice-banner';
import { CommercialOsNextStepBanner } from '@/components/journey/lovable/commercial-os-next-step-banner';
import { formatCurrency } from '@/lib/formatters/format-currency';
import {
  isParticipantPortalActivationSuccess,
  ordinaryWorkspaceCreateInvoiceHref,
  trackParticipantInvoiceActivation,
} from '@/lib/invoices/participant-activation-analytics';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { invoicePublicReference } from '@/lib/payment-links/invoice-display-status';
import type { CreatePaymentLinkResult } from '@/lib/payment-links/create-payment-link-from-draft';

export function CreateInvoiceSuccess({
  created,
  onCopyLink,
  copied,
  organizationId,
}: {
  created: CreatePaymentLinkResult;
  onCopyLink: () => void;
  copied: boolean;
  organizationId?: string | null;
}) {
  const reference = invoicePublicReference(created);
  const detailHref = COMMERCIAL_OS_ROUTES.invoiceDetail(reference, { id: created.id });
  const sendHref = `${detailHref}?send=1`;
  const activation = isParticipantPortalActivationSuccess(created.invoiceOrigin);
  const anotherInvoiceHref = ordinaryWorkspaceCreateInvoiceHref();

  useEffect(() => {
    if (!activation) return;
    trackParticipantInvoiceActivation('workspace_ready_activation_shown', {
      organizationId: organizationId ?? null,
      invoiceId: created.id,
      invoiceOrigin: created.invoiceOrigin ?? null,
    });
  }, [activation, created.id, created.invoiceOrigin, organizationId]);

  return (
    <div
      data-testid={activation ? 'participant-invoice-activation-success' : 'create-invoice-success'}
      className="animate-fade-up mx-auto max-w-2xl space-y-8 pb-24 pt-4"
    >
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Check className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em]">Invoice created</h1>
        <p className="mt-3 text-[15px] text-ink-soft">
          {reference} is ready to send
          {created.amount != null && created.currency
            ? ` · ${formatCurrency(Number(created.amount), created.currency)}`
            : ''}
          .
        </p>
      </div>

      {activation ? (
        <CommercialOsNextStepBanner
          tone="success"
          title="Your workspace is ready"
          message="You can now create and manage invoices for your other work from this workspace."
          action={
            <Link
              href={anotherInvoiceHref}
              data-testid="create-another-invoice"
              onClick={() =>
                trackParticipantInvoiceActivation('create_another_invoice_clicked', {
                  organizationId: organizationId ?? null,
                  invoiceId: created.id,
                  invoiceOrigin: created.invoiceOrigin ?? null,
                })
              }
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-purple px-5 text-[13.5px] font-semibold text-primary-foreground shadow-glow transition-all hover:brightness-110"
            >
              Create another invoice
            </Link>
          }
        />
      ) : (
        <CommercialOsNextStepBanner
          title="Next recommended action"
          message="Send this invoice to your customer so they can view details and pay."
          action={
            <Link
              href={sendHref}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-purple px-5 text-[13.5px] font-semibold text-primary-foreground shadow-glow transition-all hover:brightness-110"
            >
              <Send className="h-4 w-4" />
              Send invoice
            </Link>
          }
        />
      )}

      <AccountingFirstInvoiceBanner returnTo={detailHref} />

      <div className={`grid gap-3 ${activation ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
        {activation ? (
          <Link
            href={sendHref}
            className="inline-flex h-12 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card px-4 text-[13px] font-semibold transition-colors hover:bg-secondary"
          >
            <Send className="h-4 w-4" />
            Send invoice
          </Link>
        ) : null}
        <Link
          href={detailHref}
          className="inline-flex h-12 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card px-4 text-[13px] font-semibold transition-colors hover:bg-secondary"
        >
          <FileText className="h-4 w-4" />
          Open invoice
        </Link>
        <button
          type="button"
          onClick={onCopyLink}
          className="inline-flex h-12 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card px-4 text-[13px] font-semibold transition-colors hover:bg-secondary"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy payment link'}
        </button>
        <Link
          href={COMMERCIAL_OS_ROUTES.workspace}
          className="inline-flex h-12 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card px-4 text-[13px] font-semibold transition-colors hover:bg-secondary"
        >
          <ArrowRight className="h-4 w-4" />
          Return to workspace
        </Link>
      </div>
    </div>
  );
}
