/**
 * Merchant-facing invoice display helpers (Commercial OS + legacy list views).
 * Maps payment_links operational status to simplified receivables labels.
 */

import { format, formatDistanceToNow, isPast } from 'date-fns';
import { invoiceCreationLabelForPaymentMethod } from '@/lib/payments/payment-rail-registry';
import { operationalStatusLabel } from '@/lib/payments/operational-status-labels';

export type InvoiceDisplayStatus = 'Paid' | 'Sent' | 'Overdue' | 'Draft' | 'Cancelled' | 'Confirming';

export const INVOICE_DISPLAY_STATUS_CLS: Record<InvoiceDisplayStatus, string> = {
  Paid: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  Sent: 'bg-primary/10 text-primary',
  Overdue: 'bg-destructive/10 text-destructive',
  Draft: 'bg-secondary text-ink-soft',
  Cancelled: 'bg-secondary text-ink-soft line-through',
  Confirming: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
};

type LinkLike = {
  status: string;
  dueDate?: Date | string | null;
  paidAt?: Date | string | null;
  invoiceOnlyMode?: boolean;
  paymentMethod?: string | null;
};

export function toInvoiceDisplayStatus(link: LinkLike): InvoiceDisplayStatus {
  if (link.status === 'PAID') return 'Paid';
  if (link.status === 'CANCELED' || link.status === 'EXPIRED') return 'Cancelled';
  if (link.status === 'PAID_UNVERIFIED' || link.status === 'REQUIRES_REVIEW') return 'Confirming';
  if (link.status === 'DRAFT') return 'Draft';
  if (link.dueDate) {
    const due = new Date(link.dueDate);
    if (!Number.isNaN(due.getTime()) && isPast(due)) return 'Overdue';
  }
  return 'Sent';
}

export function formatInvoiceDueLabel(link: LinkLike): string {
  if (link.status === 'PAID') {
    if (link.paidAt) {
      const paid = new Date(link.paidAt);
      if (!Number.isNaN(paid.getTime())) return `Paid ${formatDistanceToNow(paid, { addSuffix: true })}`;
    }
    return 'Paid';
  }
  if (link.status === 'CANCELED') return 'Cancelled';
  if (link.status === 'EXPIRED') return 'Expired';
  if (link.status === 'DRAFT') return 'Not sent';
  if (!link.dueDate) return '—';
  const due = new Date(link.dueDate);
  if (Number.isNaN(due.getTime())) return '—';
  return formatDistanceToNow(due, { addSuffix: true });
}

export function invoicePaymentMethodLabel(link: LinkLike): string {
  if (link.invoiceOnlyMode) return 'Invoice only';
  if (!link.paymentMethod) return '—';
  try {
    return invoiceCreationLabelForPaymentMethod(
      link.paymentMethod as Parameters<typeof invoiceCreationLabelForPaymentMethod>[0]
    );
  } catch {
    return link.paymentMethod;
  }
}

export type PaymentDisplayStatus = 'Unpaid' | 'Part paid' | 'Confirming' | 'Settled';

export function toPaymentDisplayStatus(
  link: LinkLike,
  amountOutstanding?: number | null,
  invoiceAmount?: number | null
): PaymentDisplayStatus {
  if (link.status === 'PAID') return 'Settled';
  if (link.status === 'PAID_UNVERIFIED' || link.status === 'REQUIRES_REVIEW') return 'Confirming';
  if (
    typeof amountOutstanding === 'number' &&
    typeof invoiceAmount === 'number' &&
    amountOutstanding > 0 &&
    amountOutstanding < invoiceAmount
  ) {
    return 'Part paid';
  }
  return 'Unpaid';
}

export function invoiceHeroState(link: LinkLike): {
  headline: string;
  tone: 'good' | 'warn' | 'bad' | 'info';
} {
  const display = toInvoiceDisplayStatus(link);
  if (display === 'Paid') return { headline: 'Paid', tone: 'good' };
  if (display === 'Cancelled') return { headline: operationalStatusLabel(link.status), tone: 'info' };
  if (display === 'Confirming') return { headline: 'Payment confirming', tone: 'info' };
  if (display === 'Overdue') return { headline: 'Overdue', tone: 'bad' };
  if (display === 'Draft') return { headline: 'Draft, not sent', tone: 'info' };
  return { headline: 'Awaiting payment', tone: 'warn' };
}

export function formatInvoiceCreatedLabel(createdAt: Date | string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, 'd MMM');
}

export function invoicePublicReference(link: {
  invoiceReference?: string | null;
  shortCode?: string | null;
}): string {
  return link.invoiceReference?.trim() || link.shortCode?.trim() || '—';
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPaymentLinkUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}
