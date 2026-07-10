import type { TimelineLineageStep } from '@/lib/workspace-timeline/types';

type PaymentLinkLike = {
  id: string;
  shortCode: string;
  xeroInvoiceNumber?: string | null;
  invoiceReference?: string | null;
};

export function buildPaymentLinkLineage(
  link: PaymentLinkLike,
  status: string
): TimelineLineageStep[] {
  const invoice = link.xeroInvoiceNumber ?? link.invoiceReference ?? link.shortCode;
  const steps: TimelineLineageStep[] = [
    { label: 'Revenue', layer: 'commercial' },
    { label: `Invoice #${invoice}`, layer: 'commercial' },
    { label: 'Payment link', layer: 'commercial' },
    { label: 'Commercial forecast', layer: 'commercial' },
    { label: 'Accounting layer', layer: 'accounting' },
    { label: 'Settlement', layer: 'settlement' },
  ];

  if (status === 'awaiting_payment') {
    return steps.slice(0, 4);
  }
  if (status === 'payment_confirmed') {
    return steps.slice(0, 5);
  }
  return steps;
}

export function buildObligationLineage(row: {
  obligation_type: string;
  participant?: { name?: string };
}): TimelineLineageStep[] {
  const steps: TimelineLineageStep[] = [];
  if (row.participant?.name) {
    steps.push({ label: 'Budgeted role', layer: 'commercial' });
    steps.push({ label: row.participant.name, layer: 'operational' });
  }
  steps.push(
    { label: 'Obligation', layer: 'commercial' },
    { label: 'Settlement', layer: 'settlement' },
    { label: 'Accounting entry', layer: 'accounting' }
  );
  return steps;
}

export function buildFundingLineage(source: { name: string; sourceType: string }): TimelineLineageStep[] {
  return [
    { label: source.sourceType, layer: 'commercial' },
    { label: source.name, layer: 'commercial' },
    { label: 'Commercial forecast', layer: 'commercial' },
  ];
}
