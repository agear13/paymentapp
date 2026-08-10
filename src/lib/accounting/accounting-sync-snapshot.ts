/**
 * Snapshot of accounting-relevant invoice fields at export time.
 * Used to detect drift after Provvy edits without auto-syncing to Xero.
 */

import type { AccountingEditableField } from '@/lib/accounting/accounting-edit-policy';

export type AccountingSyncSnapshot = {
  amount: string;
  currency: string;
  description: string;
  customerEmail: string | null;
  customerName: string | null;
  invoiceReference: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
};

export type AccountingSyncDriftResult = {
  hasDrift: boolean;
  changedFields: AccountingEditableField[];
};

export type AccountingLinkLike = {
  amount: unknown;
  currency?: string | null;
  invoiceCurrency?: string | null;
  description?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  invoiceReference?: string | null;
  invoiceDate?: Date | string | null;
  dueDate?: Date | string | null;
};

function normalizeAmount(value: unknown): string {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return '';
  return numeric.toFixed(2);
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function normalizeDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function buildAccountingSyncSnapshot(link: AccountingLinkLike): AccountingSyncSnapshot {
  return {
    amount: normalizeAmount(link.amount),
    currency: normalizeText(link.invoiceCurrency ?? link.currency ?? ''),
    description: normalizeText(link.description),
    customerEmail: normalizeText(link.customerEmail) || null,
    customerName: normalizeText(link.customerName) || null,
    invoiceReference: normalizeText(link.invoiceReference) || null,
    invoiceDate: normalizeDate(link.invoiceDate),
    dueDate: normalizeDate(link.dueDate),
  };
}

export function parseAccountingSyncSnapshot(
  payload: unknown
): AccountingSyncSnapshot | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const snapshot = record.accountingSnapshot;
  if (!snapshot || typeof snapshot !== 'object') return null;
  const s = snapshot as Record<string, unknown>;
  if (typeof s.amount !== 'string' || typeof s.currency !== 'string') return null;
  return {
    amount: s.amount,
    currency: s.currency,
    description: typeof s.description === 'string' ? s.description : '',
    customerEmail: typeof s.customerEmail === 'string' ? s.customerEmail : null,
    customerName: typeof s.customerName === 'string' ? s.customerName : null,
    invoiceReference: typeof s.invoiceReference === 'string' ? s.invoiceReference : null,
    invoiceDate: typeof s.invoiceDate === 'string' ? s.invoiceDate : null,
    dueDate: typeof s.dueDate === 'string' ? s.dueDate : null,
  };
}

const SNAPSHOT_FIELD_MAP: Array<{
  field: AccountingEditableField;
  key: keyof AccountingSyncSnapshot;
}> = [
  { field: 'amount', key: 'amount' },
  { field: 'currency', key: 'currency' },
  { field: 'description', key: 'description' },
  { field: 'customerEmail', key: 'customerEmail' },
  { field: 'customerName', key: 'customerName' },
  { field: 'invoiceReference', key: 'invoiceReference' },
  { field: 'invoiceDate', key: 'invoiceDate' },
  { field: 'dueDate', key: 'dueDate' },
];

export function detectAccountingSyncDrift(
  current: AccountingSyncSnapshot,
  baseline: AccountingSyncSnapshot | null | undefined
): AccountingSyncDriftResult {
  if (!baseline) {
    return { hasDrift: false, changedFields: [] };
  }

  const changedFields: AccountingEditableField[] = [];
  for (const { field, key } of SNAPSHOT_FIELD_MAP) {
    const left = current[key] ?? null;
    const right = baseline[key] ?? null;
    if (left !== right) {
      changedFields.push(field);
    }
  }

  return {
    hasDrift: changedFields.length > 0,
    changedFields,
  };
}

export function hasAccountingContentDrift(
  link: AccountingLinkLike,
  responsePayload: unknown,
  linkUpdatedAt?: Date | string | null,
  syncUpdatedAt?: Date | string | null
): AccountingSyncDriftResult {
  const snapshot = parseAccountingSyncSnapshot(responsePayload);
  if (snapshot) {
    return detectAccountingSyncDrift(buildAccountingSyncSnapshot(link), snapshot);
  }

  // Legacy rows without snapshot — fall back to updated_at comparison.
  if (!linkUpdatedAt || !syncUpdatedAt) {
    return { hasDrift: false, changedFields: [] };
  }
  const linkMs = new Date(linkUpdatedAt).getTime();
  const syncMs = new Date(syncUpdatedAt).getTime();
  if (Number.isNaN(linkMs) || Number.isNaN(syncMs) || linkMs <= syncMs) {
    return { hasDrift: false, changedFields: [] };
  }
  return { hasDrift: true, changedFields: ['description'] };
}
