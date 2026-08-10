/**
 * Accounting push UI state — determines Push vs Already synced vs Update.
 */

import {
  hasAccountingContentDrift,
  parseAccountingSyncSnapshot,
} from '@/lib/accounting/accounting-sync-snapshot';

export type AccountingInvoiceSyncRow = {
  syncType: string;
  status: string;
  xeroInvoiceId?: string | null;
  updatedAt?: Date | string | null;
  createdAt?: Date | string | null;
  responsePayload?: unknown;
  accountingSnapshot?: unknown;
};

export type AccountingPushUiState =
  | 'push'
  | 'already_synced'
  | 'sync_pending'
  | 'sync_failed'
  | 'update';

export type AccountingPushState = {
  state: AccountingPushUiState;
  lastSyncedAt: string | null;
  xeroInvoiceId: string | null;
  syncId: string | null;
  hasLocalChanges: boolean;
  changedFields: string[];
};

export type AccountingSyncDisplayStatus =
  | 'not_synced'
  | 'synced'
  | 'local_changes'
  | 'sync_pending'
  | 'sync_failed'
  | 'update_pending';

export function isAccountingInvoiceExported(sync: AccountingInvoiceSyncRow | null | undefined): boolean {
  return (
    sync?.syncType === 'INVOICE' &&
    sync.status === 'SUCCESS' &&
    Boolean(sync.xeroInvoiceId?.trim())
  );
}

export function parseSyncTimestamp(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function hasInvoiceChangedSinceSync(
  linkUpdatedAt: Date | string | null | undefined,
  syncUpdatedAt: Date | string | null | undefined
): boolean {
  const linkMs = parseSyncTimestamp(linkUpdatedAt);
  const syncMs = parseSyncTimestamp(syncUpdatedAt);
  if (linkMs == null || syncMs == null) return false;
  return linkMs > syncMs;
}

export function resolveAccountingPushState(input: {
  invoiceSync?: AccountingInvoiceSyncRow | null;
  linkUpdatedAt?: Date | string | null;
  link?: {
    amount: unknown;
    currency?: string | null;
    invoiceCurrency?: string | null;
    description?: string | null;
    customerEmail?: string | null;
    customerName?: string | null;
    invoiceReference?: string | null;
    invoiceDate?: Date | string | null;
    dueDate?: Date | string | null;
  } | null;
}): AccountingPushState {
  const invoiceSync = input.invoiceSync;
  const lastSyncedAt =
    invoiceSync?.updatedAt != null
      ? String(invoiceSync.updatedAt)
      : invoiceSync?.createdAt != null
        ? String(invoiceSync.createdAt)
        : null;

  const drift =
    input.link && isAccountingInvoiceExported(invoiceSync ?? null)
      ? hasAccountingContentDrift(
          input.link,
          invoiceSync?.responsePayload ?? {
            accountingSnapshot: invoiceSync?.accountingSnapshot ?? null,
          },
          input.linkUpdatedAt,
          invoiceSync?.updatedAt ?? invoiceSync?.createdAt
        )
      : { hasDrift: false, changedFields: [] as string[] };

  const base = {
    lastSyncedAt,
    xeroInvoiceId: invoiceSync?.xeroInvoiceId?.trim() || null,
    syncId: null,
    hasLocalChanges: drift.hasDrift,
    changedFields: drift.changedFields,
  };

  if (!invoiceSync || invoiceSync.syncType !== 'INVOICE') {
    return {
      state: 'push',
      ...base,
      xeroInvoiceId: null,
      hasLocalChanges: false,
      changedFields: [],
    };
  }

  if (invoiceSync.status === 'PENDING' || invoiceSync.status === 'RETRYING') {
    return {
      state: 'sync_pending',
      ...base,
    };
  }

  if (invoiceSync.status === 'FAILED') {
    return {
      state: 'sync_failed',
      ...base,
    };
  }

  if (isAccountingInvoiceExported(invoiceSync)) {
    if (drift.hasDrift) {
      return {
        state: 'update',
        ...base,
      };
    }
    return {
      state: 'already_synced',
      ...base,
      hasLocalChanges: false,
      changedFields: [],
    };
  }

  return {
    state: 'push',
    ...base,
  };
}

export function resolveAccountingSyncDisplayStatus(
  pushState: AccountingPushState
): AccountingSyncDisplayStatus {
  switch (pushState.state) {
    case 'push':
      return 'not_synced';
    case 'already_synced':
      return 'synced';
    case 'update':
      return pushState.hasLocalChanges ? 'local_changes' : 'update_pending';
    case 'sync_pending':
      return 'sync_pending';
    case 'sync_failed':
      return 'sync_failed';
    default:
      return 'not_synced';
  }
}

export function accountingSyncDisplayLabel(status: AccountingSyncDisplayStatus): string {
  switch (status) {
    case 'synced':
      return 'Synced';
    case 'local_changes':
      return 'Local changes not synced';
    case 'sync_pending':
      return 'Sync in progress';
    case 'sync_failed':
      return 'Sync failed';
    case 'update_pending':
      return 'Update pending';
    default:
      return 'Not synced';
  }
}

export function formatAccountingLastSyncedLabel(iso: string | null): string {
  if (!iso) return 'Already synced';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Already synced';
  return `Last synced ${date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })}`;
}
