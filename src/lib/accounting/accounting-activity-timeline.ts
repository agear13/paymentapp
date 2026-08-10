/**
 * Read-only accounting activity timeline derived from existing Xero sync records.
 */

export type XeroSyncForActivityTimeline = {
  syncType: string;
  status: string;
  createdAt: Date | string;
  updatedAt?: Date | string | null;
  xeroInvoiceId?: string | null;
  voidedAt?: string | null;
  lastRequestWasUpdate?: boolean;
};

export type AccountingActivityEvent = {
  id: string;
  label: string;
  occurredAt: string;
  kind: 'exported' | 'updated' | 'voided' | 'payment_synced' | 'sync_failed';
};

const EXPORT_UPDATE_GAP_MS = 60_000;

function toTime(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

export function buildAccountingActivityTimeline(
  syncs: XeroSyncForActivityTimeline[] | null | undefined
): AccountingActivityEvent[] {
  if (!syncs?.length) return [];

  const events: AccountingActivityEvent[] = [];
  const invoiceSync = syncs.find((s) => s.syncType === 'INVOICE');
  const paymentSync = syncs.find((s) => s.syncType === 'PAYMENT');

  if (invoiceSync?.status === 'SUCCESS' && invoiceSync.xeroInvoiceId) {
    const createdAt = invoiceSync.createdAt;
    events.push({
      id: 'exported',
      kind: 'exported',
      label: 'Exported to Xero',
      occurredAt: new Date(createdAt).toISOString(),
    });

    const createdMs = toTime(invoiceSync.createdAt);
    const updatedMs = toTime(invoiceSync.updatedAt);
    const voidedMs = toTime(invoiceSync.voidedAt);

    const hasMeaningfulUpdate =
      invoiceSync.lastRequestWasUpdate === true ||
      (createdMs != null &&
        updatedMs != null &&
        updatedMs - createdMs >= EXPORT_UPDATE_GAP_MS &&
        (voidedMs == null || updatedMs < voidedMs));

    if (hasMeaningfulUpdate && invoiceSync.updatedAt) {
      events.push({
        id: 'updated',
        kind: 'updated',
        label: 'Updated',
        occurredAt: new Date(invoiceSync.updatedAt).toISOString(),
      });
    }

    if (invoiceSync.voidedAt) {
      events.push({
        id: 'voided',
        kind: 'voided',
        label: 'Voided',
        occurredAt: new Date(invoiceSync.voidedAt).toISOString(),
      });
    }
  } else if (invoiceSync?.status === 'FAILED') {
    events.push({
      id: 'export-failed',
      kind: 'sync_failed',
      label: 'Export failed',
      occurredAt: new Date(invoiceSync.updatedAt ?? invoiceSync.createdAt).toISOString(),
    });
  }

  if (paymentSync?.status === 'SUCCESS') {
    events.push({
      id: 'payment-synced',
      kind: 'payment_synced',
      label: 'Payment synced to Xero',
      occurredAt: new Date(paymentSync.updatedAt ?? paymentSync.createdAt).toISOString(),
    });
  }

  return events.sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  );
}

export function formatAccountingActivityDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
