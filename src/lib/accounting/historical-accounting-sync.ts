/**
 * Historical accounting sync discovery — pure logic (no DB).
 * Used after a merchant connects accounting to find unsynced commercial documents.
 */

export type HistoricalXeroSyncRow = {
  sync_type: string;
  status: string;
  xero_invoice_id?: string | null;
  xero_payment_id?: string | null;
  error_message?: string | null;
};

export type HistoricalPaymentLinkRow = {
  id: string;
  status: string;
  invoice_reference?: string | null;
  short_code: string;
  customer_name?: string | null;
  customer_email?: string | null;
  invoice_date?: Date | string | null;
  created_at: Date | string;
  amount: unknown;
  invoice_currency: string;
  currency: string;
  settlement_amount?: unknown | null;
  xero_syncs: HistoricalXeroSyncRow[];
};

export type HistoricalSyncNeeds = {
  needsInvoiceSync: boolean;
  needsPaymentSync: boolean;
  needsSettlementExport: boolean;
  included: boolean;
};

export type HistoricalSyncItem = {
  paymentLinkId: string;
  invoiceNumber: string;
  customer: string | null;
  date: string;
  amount: string;
  currency: string;
  status: string;
  syncStatus: string;
  needsInvoiceSync: boolean;
  needsPaymentSync: boolean;
  needsSettlementExport: boolean;
};

export type HistoricalSyncPreview = {
  totalUnsynced: number;
  invoiceSyncCount: number;
  paymentSyncCount: number;
  settlementExportCount: number;
  items: HistoricalSyncItem[];
};

export type HistoricalSyncExecuteResult = {
  queued: number;
  skipped: number;
  failed: number;
  details: Array<{
    paymentLinkId: string;
    syncType: 'INVOICE' | 'PAYMENT';
    success: boolean;
    syncId?: string;
    error?: string;
    skipped?: boolean;
  }>;
};

export const PAID_LINK_STATUSES = new Set([
  'PAID',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'PAID_UNVERIFIED',
  'REQUIRES_REVIEW',
]);

export const EXCLUDED_FROM_HISTORICAL_SYNC = new Set(['DRAFT', 'CANCELED']);

export function isInvoiceSyncSuccess(sync: HistoricalXeroSyncRow | undefined): boolean {
  return (
    sync?.sync_type === 'INVOICE' &&
    sync.status === 'SUCCESS' &&
    Boolean(sync.xero_invoice_id)
  );
}

export function isPaymentSyncSuccess(sync: HistoricalXeroSyncRow | undefined): boolean {
  return sync?.sync_type === 'PAYMENT' && sync.status === 'SUCCESS';
}

export function classifyHistoricalSyncNeeds(
  link: Pick<HistoricalPaymentLinkRow, 'status' | 'settlement_amount'>,
  syncs: HistoricalXeroSyncRow[]
): HistoricalSyncNeeds {
  if (EXCLUDED_FROM_HISTORICAL_SYNC.has(link.status)) {
    return {
      needsInvoiceSync: false,
      needsPaymentSync: false,
      needsSettlementExport: false,
      included: false,
    };
  }

  const invoiceSync = syncs.find((row) => row.sync_type === 'INVOICE');
  const paymentSync = syncs.find((row) => row.sync_type === 'PAYMENT');

  const needsInvoiceSync = !isInvoiceSyncSuccess(invoiceSync);
  const needsPaymentSync =
    PAID_LINK_STATUSES.has(link.status) && !isPaymentSyncSuccess(paymentSync);
  const hasSettlement = link.settlement_amount != null;
  const needsSettlementExport = hasSettlement && needsPaymentSync;
  const included = needsInvoiceSync || needsPaymentSync;

  return { needsInvoiceSync, needsPaymentSync, needsSettlementExport, included };
}

export function historicalSyncStatusLabel(needs: Omit<HistoricalSyncNeeds, 'included'>): string {
  if (needs.needsSettlementExport && !needs.needsInvoiceSync) {
    return 'Settlement awaiting export';
  }
  if (needs.needsInvoiceSync && needs.needsPaymentSync) {
    return 'Not synced';
  }
  if (needs.needsInvoiceSync) {
    return 'Invoice not synced';
  }
  if (needs.needsPaymentSync) {
    return 'Payment not synced';
  }
  return 'Synced';
}

export function historicalSyncBannerMessage(count: number): string {
  const noun = count === 1 ? 'invoice' : 'invoices';
  return `We found ${count} ${noun} that haven't been synced to your accounting software.`;
}

export function resolveInvoiceNumber(
  link: Pick<HistoricalPaymentLinkRow, 'invoice_reference' | 'short_code'>
): string {
  return link.invoice_reference?.trim() || link.short_code.trim();
}

export function resolveCustomerLabel(
  link: Pick<HistoricalPaymentLinkRow, 'customer_name' | 'customer_email'>
): string | null {
  return link.customer_name?.trim() || link.customer_email?.trim() || null;
}

export function resolveHistoricalDate(
  link: Pick<HistoricalPaymentLinkRow, 'invoice_date' | 'created_at'>
): string {
  const raw = link.invoice_date ?? link.created_at;
  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toISOString();
}

export function buildHistoricalSyncPreview(
  links: HistoricalPaymentLinkRow[],
  formatAmount: (amount: unknown, currency: string) => string
): HistoricalSyncPreview {
  const items: HistoricalSyncItem[] = [];

  for (const link of links) {
    const needs = classifyHistoricalSyncNeeds(link, link.xero_syncs);
    if (!needs.included) continue;

    items.push({
      paymentLinkId: link.id,
      invoiceNumber: resolveInvoiceNumber(link),
      customer: resolveCustomerLabel(link),
      date: resolveHistoricalDate(link),
      amount: formatAmount(link.amount, link.invoice_currency || link.currency),
      currency: link.invoice_currency || link.currency,
      status: link.status,
      syncStatus: historicalSyncStatusLabel(needs),
      needsInvoiceSync: needs.needsInvoiceSync,
      needsPaymentSync: needs.needsPaymentSync,
      needsSettlementExport: needs.needsSettlementExport,
    });
  }

  return {
    totalUnsynced: items.length,
    invoiceSyncCount: items.filter((item) => item.needsInvoiceSync).length,
    paymentSyncCount: items.filter((item) => item.needsPaymentSync).length,
    settlementExportCount: items.filter((item) => item.needsSettlementExport).length,
    items,
  };
}

export type QueueHistoricalSyncInput = {
  items: HistoricalSyncItem[];
  paymentLinkIds?: string[];
  syncAll?: boolean;
};

export function selectHistoricalSyncItems(
  preview: HistoricalSyncPreview,
  params: Pick<QueueHistoricalSyncInput, 'paymentLinkIds' | 'syncAll'>
): HistoricalSyncItem[] {
  if (params.syncAll) return preview.items;
  const ids = new Set((params.paymentLinkIds ?? []).map((id) => id.trim()).filter(Boolean));
  if (ids.size === 0) return [];
  return preview.items.filter((item) => ids.has(item.paymentLinkId));
}

export function syncTypesToQueueForItem(item: HistoricalSyncItem): Array<'INVOICE' | 'PAYMENT'> {
  const types: Array<'INVOICE' | 'PAYMENT'> = [];
  if (item.needsInvoiceSync) types.push('INVOICE');
  if (item.needsPaymentSync) types.push('PAYMENT');
  return types;
}
