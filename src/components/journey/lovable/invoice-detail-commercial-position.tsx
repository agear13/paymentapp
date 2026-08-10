'use client';

import { formatCurrency } from '@/lib/formatters/format-currency';
import { InvoiceDetailField, InvoiceDetailSectionHeading } from '@/components/journey/lovable/invoice-detail-ui';

type InvoiceDetailCommercialPositionProps = {
  currency: string;
  invoiceAmount: number;
  amountPaid: number;
  amountOutstanding: number;
  settlementLabel: string | null;
};

export function InvoiceDetailCommercialPosition({
  currency,
  invoiceAmount,
  amountPaid,
  amountOutstanding,
  settlementLabel,
}: InvoiceDetailCommercialPositionProps) {
  const rows = [
    { label: 'Invoice total', value: formatCurrency(invoiceAmount, currency) },
    { label: 'Amount paid', value: formatCurrency(amountPaid, currency) },
    { label: 'Amount outstanding', value: formatCurrency(amountOutstanding, currency), emphasize: true },
  ];

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <InvoiceDetailSectionHeading
        eyebrow="Commercial position"
        title="Amounts"
        description="Payment totals for this invoice. Fees and participant allocations appear in ledger entries when configured."
      />
      <dl className="mt-2 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 text-[13px]">
            <dt className="text-ink-soft">{row.label}</dt>
            <dd className={`font-medium ${row.emphasize ? 'text-[15px]' : ''}`}>{row.value}</dd>
          </div>
        ))}
      </dl>
      {settlementLabel ? (
        <div className="mt-4 border-t border-border pt-4">
          <InvoiceDetailField label="Settlement" value={settlementLabel} />
        </div>
      ) : null}
    </section>
  );
}
