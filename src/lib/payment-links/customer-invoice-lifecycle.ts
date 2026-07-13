/**
 * Customer Invoice Lifecycle
 *
 * Explicit lifecycle states for payment_links (customer invoices).
 * Derived from payment link status, Xero sync records, and payment events —
 * no duplicate invoice records; identity is always the payment_link row.
 *
 * Commercial Timing → Invoice → Accounting (one direction).
 */

import type { PaymentLinkStatus, XeroSyncStatus } from '@prisma/client';
import {
  buildAccountingExportTimingContext,
  formatYearMonth,
  type ResolvedCommercialTiming,
} from '@/lib/commercial-timing';

/** Canonical customer invoice lifecycle states. */
export enum CustomerInvoiceLifecycleState {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  EXPORTED = 'EXPORTED',
  OUTSTANDING = 'OUTSTANDING',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export const CUSTOMER_INVOICE_LIFECYCLE_LABELS: Record<
  CustomerInvoiceLifecycleState,
  string
> = {
  [CustomerInvoiceLifecycleState.DRAFT]: 'Draft',
  [CustomerInvoiceLifecycleState.ISSUED]: 'Invoice Created',
  [CustomerInvoiceLifecycleState.EXPORTED]: 'Invoice Exported',
  [CustomerInvoiceLifecycleState.OUTSTANDING]: 'Awaiting Payment',
  [CustomerInvoiceLifecycleState.PARTIALLY_PAID]: 'Partially Paid',
  [CustomerInvoiceLifecycleState.PAID]: 'Invoice Paid',
  [CustomerInvoiceLifecycleState.CANCELLED]: 'Cancelled',
};

export type XeroInvoiceSyncInput = {
  syncType: 'INVOICE' | 'PAYMENT';
  status: XeroSyncStatus;
  xeroInvoiceId?: string | null;
  xeroPaymentId?: string | null;
  updatedAt?: Date | null;
} | null;

export type CustomerInvoiceLifecycleInput = {
  linkStatus: PaymentLinkStatus;
  invoiceAmount: number;
  /** Sum of confirmed payment amounts applied to this invoice. */
  amountPaid: number;
  invoiceSync: XeroInvoiceSyncInput;
  paymentSync?: XeroInvoiceSyncInput;
  createdAt: Date;
  /** When invoice export to accounting completed. */
  exportedAt?: Date | null;
  /** When payment was confirmed. */
  paymentConfirmedAt?: Date | null;
  /** When settlement became pending. */
  settlementReadyAt?: Date | null;
  /** When commercial reconciliation completed. */
  commerciallyReconciledAt?: Date | null;
  /** When bank settlement cleared. */
  bankClearedAt?: Date | null;
};

export type CustomerInvoiceLifecycleTimelineStep = {
  id: string;
  state: CustomerInvoiceLifecycleState | 'SETTLEMENT_READY' | 'COMMERCIALLY_RECONCILED' | 'BANK_CLEARED';
  label: string;
  reached: boolean;
  occurredAt: string | null;
};

/** Merchant-facing invoice timeline (export-before-payment narrative). */
export const CUSTOMER_INVOICE_MERCHANT_TIMELINE: readonly {
  id: string;
  state: CustomerInvoiceLifecycleTimelineStep['state'];
  label: string;
}[] = [
  { id: 'created', state: CustomerInvoiceLifecycleState.ISSUED, label: 'Invoice Created' },
  { id: 'exported', state: CustomerInvoiceLifecycleState.EXPORTED, label: 'Invoice Exported' },
  {
    id: 'awaiting',
    state: CustomerInvoiceLifecycleState.OUTSTANDING,
    label: 'Awaiting Payment',
  },
  {
    id: 'payment_received',
    state: CustomerInvoiceLifecycleState.PARTIALLY_PAID,
    label: 'Payment Received',
  },
  {
    id: 'commercially_reconciled',
    state: 'COMMERCIALLY_RECONCILED' as const,
    label: 'Commercially Reconciled',
  },
  {
    id: 'bank_cleared',
    state: 'BANK_CLEARED' as const,
    label: 'Bank Cleared',
  },
  { id: 'paid', state: CustomerInvoiceLifecycleState.PAID, label: 'Invoice Paid' },
  { id: 'settlement_ready', state: 'SETTLEMENT_READY', label: 'Settlement Ready' },
] as const;

function isCancelledStatus(status: PaymentLinkStatus): boolean {
  return status === 'CANCELED' || status === 'EXPIRED';
}

function isInvoiceExported(invoiceSync: XeroInvoiceSyncInput): boolean {
  return (
    invoiceSync?.syncType === 'INVOICE' &&
    invoiceSync.status === 'SUCCESS' &&
    Boolean(invoiceSync.xeroInvoiceId)
  );
}

/**
 * Derive the current customer invoice lifecycle state.
 * Backwards compatible: links without Xero sync remain ISSUED until exported.
 */
export function deriveCustomerInvoiceLifecycleState(
  input: CustomerInvoiceLifecycleInput
): CustomerInvoiceLifecycleState {
  const { linkStatus, invoiceAmount, amountPaid, invoiceSync } = input;

  if (isCancelledStatus(linkStatus)) {
    return CustomerInvoiceLifecycleState.CANCELLED;
  }

  if (linkStatus === 'DRAFT') {
    return CustomerInvoiceLifecycleState.DRAFT;
  }

  const exported = isInvoiceExported(invoiceSync);
  const fullyPaid =
    linkStatus === 'PAID' ||
    linkStatus === 'PARTIALLY_REFUNDED' ||
    linkStatus === 'REFUNDED' ||
    (amountPaid > 0 && amountPaid >= invoiceAmount - 0.001);

  if (fullyPaid) {
    return CustomerInvoiceLifecycleState.PAID;
  }

  const partiallyPaid =
    amountPaid > 0 && amountPaid < invoiceAmount - 0.001 && linkStatus === 'OPEN';

  if (partiallyPaid) {
    return CustomerInvoiceLifecycleState.PARTIALLY_PAID;
  }

  if (exported && linkStatus === 'OPEN') {
    return CustomerInvoiceLifecycleState.OUTSTANDING;
  }

  if (exported) {
    return CustomerInvoiceLifecycleState.EXPORTED;
  }

  if (
    linkStatus === 'OPEN' ||
    linkStatus === 'PAID_UNVERIFIED' ||
    linkStatus === 'REQUIRES_REVIEW'
  ) {
    return CustomerInvoiceLifecycleState.ISSUED;
  }

  return CustomerInvoiceLifecycleState.ISSUED;
}

/** Build merchant invoice timeline from lifecycle inputs. */
export function buildCustomerInvoiceLifecycleTimeline(
  input: CustomerInvoiceLifecycleInput
): CustomerInvoiceLifecycleTimelineStep[] {
  const current = deriveCustomerInvoiceLifecycleState(input);
  const exported = isInvoiceExported(input.invoiceSync);
  const hasPayment =
    input.amountPaid > 0 ||
    input.linkStatus === 'PAID' ||
    input.linkStatus === 'PAID_UNVERIFIED' ||
    input.linkStatus === 'REQUIRES_REVIEW';
  const fullyPaid = current === CustomerInvoiceLifecycleState.PAID;
  const partiallyPaid = current === CustomerInvoiceLifecycleState.PARTIALLY_PAID;
  const settlementReady = Boolean(input.settlementReadyAt);
  const commerciallyReconciled = Boolean(input.commerciallyReconciledAt);
  const bankCleared = Boolean(input.bankClearedAt);

  const stateRank: Record<string, number> = {
    [CustomerInvoiceLifecycleState.DRAFT]: 0,
    [CustomerInvoiceLifecycleState.ISSUED]: 1,
    [CustomerInvoiceLifecycleState.EXPORTED]: 2,
    [CustomerInvoiceLifecycleState.OUTSTANDING]: 3,
    [CustomerInvoiceLifecycleState.PARTIALLY_PAID]: 4,
    [CustomerInvoiceLifecycleState.PAID]: 5,
    [CustomerInvoiceLifecycleState.CANCELLED]: -1,
    SETTLEMENT_READY: 6,
  };

  const currentRank =
    current === CustomerInvoiceLifecycleState.OUTSTANDING
      ? stateRank[CustomerInvoiceLifecycleState.OUTSTANDING]
      : stateRank[current] ?? 0;

  return CUSTOMER_INVOICE_MERCHANT_TIMELINE.map((step) => {
    let reached = false;
    let occurredAt: string | null = null;

    switch (step.id) {
      case 'created':
        reached = current !== CustomerInvoiceLifecycleState.DRAFT;
        occurredAt = input.createdAt.toISOString();
        break;
      case 'exported':
        reached = exported;
        occurredAt = exported
          ? (input.exportedAt?.toISOString() ?? input.invoiceSync?.updatedAt?.toISOString() ?? null)
          : null;
        break;
      case 'awaiting':
        reached =
          exported &&
          !fullyPaid &&
          currentRank >= stateRank[CustomerInvoiceLifecycleState.OUTSTANDING];
        occurredAt = reached && input.exportedAt ? input.exportedAt.toISOString() : null;
        break;
      case 'payment_received':
        reached = hasPayment && (partiallyPaid || fullyPaid);
        occurredAt = input.paymentConfirmedAt?.toISOString() ?? null;
        break;
      case 'commercially_reconciled':
        reached = commerciallyReconciled || fullyPaid;
        occurredAt = input.commerciallyReconciledAt?.toISOString() ?? null;
        break;
      case 'bank_cleared':
        reached = bankCleared;
        occurredAt = input.bankClearedAt?.toISOString() ?? null;
        break;
      case 'paid':
        reached = fullyPaid;
        occurredAt = fullyPaid
          ? (input.paymentConfirmedAt?.toISOString() ?? null)
          : null;
        break;
      case 'settlement_ready':
        reached = settlementReady && fullyPaid;
        occurredAt = input.settlementReadyAt?.toISOString() ?? null;
        break;
      default:
        break;
    }

    return {
      id: step.id,
      state: step.state,
      label: step.label,
      reached,
      occurredAt,
    };
  });
}

export type CustomerInvoiceLifecycleSnapshot = {
  state: CustomerInvoiceLifecycleState;
  stateLabel: string;
  timeline: CustomerInvoiceLifecycleTimelineStep[];
  amountPaid: number;
  amountOutstanding: number;
  exportedToAccounting: boolean;
  xeroInvoiceId: string | null;
};

export function buildCustomerInvoiceLifecycleSnapshot(
  input: CustomerInvoiceLifecycleInput
): CustomerInvoiceLifecycleSnapshot {
  const state = deriveCustomerInvoiceLifecycleState(input);
  const exported = isInvoiceExported(input.invoiceSync);
  const amountOutstanding = Math.max(0, input.invoiceAmount - input.amountPaid);

  return {
    state,
    stateLabel: CUSTOMER_INVOICE_LIFECYCLE_LABELS[state],
    timeline: buildCustomerInvoiceLifecycleTimeline(input),
    amountPaid: input.amountPaid,
    amountOutstanding,
    exportedToAccounting: exported,
    xeroInvoiceId: input.invoiceSync?.xeroInvoiceId ?? null,
  };
}

/** Sum confirmed payment amounts for partial payment detection. */
export function sumConfirmedPaymentAmounts(
  events: { event_type: string; amount_received: unknown | null }[]
): number {
  return events
    .filter((e) => e.event_type === 'PAYMENT_CONFIRMED')
    .reduce((sum, e) => {
      const amt = Number(e.amount_received ?? 0);
      return sum + (Number.isFinite(amt) ? amt : 0);
    }, 0);
}

export type InvoiceReportingExtensionPlaceholder = {
  status: 'not_implemented';
  report: string;
  filters: Record<string, string | null>;
  message: string;
};

/** Reporting extension: outstanding receivables slice. */
export function deriveOutstandingReceivablesReportSlice(input: {
  lifecycle: CustomerInvoiceLifecycleSnapshot;
  commercialTiming: ResolvedCommercialTiming | null;
  currency: string;
}): InvoiceReportingExtensionPlaceholder {
  return {
    status: 'not_implemented',
    report: 'outstanding_receivables',
    filters: {
      lifecycleState: input.lifecycle.state,
      recognitionPeriod: input.commercialTiming?.recognitionPeriod
        ? formatYearMonth(input.commercialTiming.recognitionPeriod)
        : null,
      currency: input.currency,
    },
    message: 'Outstanding receivables report will use invoice lifecycle and commercial timing when dashboards are implemented.',
  };
}

/** Reporting extension: invoices grouped by recognition period. */
export function deriveInvoicesByRecognitionPeriodSlice(input: {
  commercialTiming: ResolvedCommercialTiming | null;
}): InvoiceReportingExtensionPlaceholder {
  const ctx = input.commercialTiming
    ? buildAccountingExportTimingContext(input.commercialTiming)
    : null;
  return {
    status: 'not_implemented',
    report: 'invoices_by_recognition_period',
    filters: {
      recognitionPeriod: ctx?.recognitionPeriodLabel ?? null,
      servicePeriod: ctx?.servicePeriodLabel ?? null,
    },
    message: 'Invoices by recognition period will derive from resolved commercial timing.',
  };
}

/** Reporting extension: invoices grouped by service period. */
export function deriveInvoicesByServicePeriodSlice(input: {
  commercialTiming: ResolvedCommercialTiming | null;
}): InvoiceReportingExtensionPlaceholder {
  const ctx = input.commercialTiming
    ? buildAccountingExportTimingContext(input.commercialTiming)
    : null;
  return {
    status: 'not_implemented',
    report: 'invoices_by_service_period',
    filters: {
      servicePeriod: ctx?.servicePeriodLabel ?? null,
    },
    message: 'Invoices by service period will derive from resolved commercial timing.',
  };
}

/** Reporting extension: outstanding payables (supplier bills). */
export function deriveOutstandingPayablesReportSlice(input: {
  currency: string;
}): InvoiceReportingExtensionPlaceholder {
  return {
    status: 'not_implemented',
    report: 'outstanding_payables',
    filters: { currency: input.currency },
    message: 'Outstanding payables report will use supplier bill lifecycle when dashboards are implemented.',
  };
}
