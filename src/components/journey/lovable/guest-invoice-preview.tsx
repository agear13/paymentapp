'use client';

import { format } from 'date-fns';
import { formatCurrency } from '@/lib/formatters/format-currency';
import type { GuestInvoiceDraft } from '@/lib/invoices/guest-invoice-draft';
import { guestInvoiceNumber } from '@/lib/invoices/guest-invoice-draft';

export function GuestInvoicePreview({
  draft,
  taxNote,
}: {
  draft: GuestInvoiceDraft;
  taxNote?: string | null;
}) {
  const hasAmount = typeof draft.amount === 'number' && draft.amount > 0;
  const total = hasAmount ? formatCurrency(draft.amount, draft.currency) : '—';
  const number = guestInvoiceNumber(draft);
  const fromName = draft.fromBusinessName.trim() || 'Your business';
  const customer = draft.customerName.trim() || draft.customerEmail.trim() || 'Add customer details';

  return (
    <article
      data-testid="guest-invoice-preview"
      className="overflow-hidden rounded-2xl border border-border bg-[#fbfbfd] text-slate-900 shadow-card dark:border-white/10"
    >
      <div className="h-1.5 bg-gradient-purple" />
      <div className="px-5 py-6 sm:px-7 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-700">
              Invoice
            </p>
            <p className="mt-2 text-[18px] font-semibold tracking-tight">{fromName}</p>
            {draft.fromBusinessEmail.trim() ? (
              <p className="mt-0.5 text-[12px] text-slate-500">{draft.fromBusinessEmail.trim()}</p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-[12px] text-slate-500">Invoice {number}</p>
            <p className="mt-1 text-[12px] text-slate-500">
              Issued {format(draft.invoiceDate, 'd MMM yyyy')}
            </p>
            {draft.dueDate ? (
              <p className="mt-1 text-[12px] font-medium text-slate-700">
                Due {format(draft.dueDate, 'd MMM yyyy')}
              </p>
            ) : (
              <p className="mt-1 text-[12px] text-slate-400">Due date not set</p>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Bill to
            </p>
            <p className="mt-1.5 text-[14px] font-semibold">{customer}</p>
            {draft.customerEmail.trim() && draft.customerName.trim() ? (
              <p className="mt-0.5 text-[12px] text-slate-500">{draft.customerEmail.trim()}</p>
            ) : null}
            {draft.customerPhone.trim() ? (
              <p className="mt-0.5 text-[12px] text-slate-500">{draft.customerPhone.trim()}</p>
            ) : null}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Currency
            </p>
            <p className="mt-1.5 text-[14px] font-medium">{draft.currency}</p>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Description</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-200">
                <td className="px-4 py-3 text-slate-700">
                  {draft.description.trim() || (
                    <span className="text-slate-400">Add a description</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">{total}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <dl className="w-full max-w-[240px] space-y-2 text-[13px]">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="font-medium tabular-nums">{total}</dd>
            </div>
            {taxNote?.trim() ? (
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Tax</dt>
                <dd className="max-w-[140px] text-right text-slate-600">{taxNote.trim()}</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-2">
              <dt className="font-semibold">Total</dt>
              <dd className="text-[18px] font-semibold tabular-nums tracking-tight">{total}</dd>
            </div>
          </dl>
        </div>

        {draft.paymentTermsNote.trim() ? (
          <div className="mt-6 rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Payment terms
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
              {draft.paymentTermsNote.trim()}
            </p>
          </div>
        ) : null}
      </div>
    </article>
  );
}
