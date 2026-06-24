'use client';

import { Info } from 'lucide-react';
import type { AgreementSummaryData } from '@/lib/commercial/participant-commercial-lifecycle';

type Props = {
  summary: AgreementSummaryData;
  className?: string;
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/**
 * Agreement Summary — shown at the start of Payment & Tax Information workflow.
 * Participants confirm commercial terms before entering payment details.
 */
export function AgreementSummary({ summary, className }: Props) {
  const rows: { label: string; value: string }[] = [
    { label: 'Role', value: summary.role },
    { label: 'Commercial agreement', value: summary.commercialAgreement },
    { label: 'Earnings structure', value: summary.paymentStructure },
    { label: 'Payment frequency', value: summary.paymentSchedule },
    { label: 'Agreed payout date', value: formatDate(summary.agreedPayoutDate) },
    { label: 'Commercial obligations', value: summary.obligationsSummary },
    { label: 'Agreement accepted', value: formatDate(summary.acceptedDate) },
  ];

  return (
    <section
      className={className ?? 'rounded-lg border bg-card p-4 space-y-4'}
      aria-labelledby="agreement-summary-heading"
    >
      <div>
        <h2 id="agreement-summary-heading" className="text-base font-semibold">
          Agreement summary
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Confirm what you agreed to before entering payment details.
        </p>
      </div>

      <dl className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="grid gap-1 sm:grid-cols-[140px_1fr] sm:gap-4">
            <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {row.label}
            </dt>
            <dd className="text-sm text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="rounded-lg border border-blue-100 bg-blue-50/80 p-3 flex gap-2">
        <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 leading-relaxed">
          If anything above does not match your agreement, contact your organiser before
          submitting payment information.
        </p>
      </div>
    </section>
  );
}
