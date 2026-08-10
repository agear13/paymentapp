/**
 * Field-level policy for commercial invoice edits after accounting sync.
 * Provvy is the system of record; Xero is a synchronized projection.
 */

export type AccountingFieldPolicy =
  | 'update_accounting'
  | 'manual_resync'
  | 'locked'
  | 'provvy_only'
  | 'display_warning';

export type AccountingEditableField =
  | 'customerName'
  | 'customerEmail'
  | 'customerPhone'
  | 'amount'
  | 'currency'
  | 'description'
  | 'invoiceReference'
  | 'invoiceDate'
  | 'dueDate'
  | 'tax'
  | 'lineItems'
  | 'paymentTerms'
  | 'status'
  | 'paymentMethod'
  | 'expiresAt'
  | 'attachment';

export const ACCOUNTING_EDIT_FIELD_POLICY: Record<
  AccountingEditableField,
  { policy: AccountingFieldPolicy; label: string; note: string }
> = {
  customerName: {
    policy: 'update_accounting',
    label: 'Customer',
    note: 'Updates Xero contact/invoice on explicit resync.',
  },
  customerEmail: {
    policy: 'update_accounting',
    label: 'Customer email',
    note: 'Updates Xero contact/invoice on explicit resync.',
  },
  customerPhone: {
    policy: 'provvy_only',
    label: 'Customer phone',
    note: 'Provvy-only; not exported to accounting.',
  },
  amount: {
    policy: 'manual_resync',
    label: 'Amount',
    note: 'Requires Update Accounting — never auto-overwrites Xero.',
  },
  currency: {
    policy: 'manual_resync',
    label: 'Currency',
    note: 'Requires Update Accounting — never auto-overwrites Xero.',
  },
  description: {
    policy: 'update_accounting',
    label: 'Description',
    note: 'Updates Xero line description on explicit resync.',
  },
  invoiceReference: {
    policy: 'update_accounting',
    label: 'Invoice number',
    note: 'Updates Xero reference on explicit resync.',
  },
  invoiceDate: {
    policy: 'update_accounting',
    label: 'Invoice date',
    note: 'Updates Xero invoice date on explicit resync.',
  },
  dueDate: {
    policy: 'update_accounting',
    label: 'Due date',
    note: 'Updates Xero due date on explicit resync.',
  },
  tax: {
    policy: 'locked',
    label: 'Tax',
    note: 'Tax treatment is fixed at export (EXEMPTOUTPUT). Change via accounting settings, not invoice edit.',
  },
  lineItems: {
    policy: 'manual_resync',
    label: 'Line items',
    note: 'Provvy uses a single line item; amount/description changes require Update Accounting.',
  },
  paymentTerms: {
    policy: 'update_accounting',
    label: 'Payment terms',
    note: 'Represented by due date in Xero; update via due date + explicit resync.',
  },
  status: {
    policy: 'locked',
    label: 'Status',
    note: 'Lifecycle transitions (paid, canceled) are separate from invoice body edits.',
  },
  paymentMethod: {
    policy: 'provvy_only',
    label: 'Payment method',
    note: 'Checkout rail configuration is Provvy-only until payment sync.',
  },
  expiresAt: {
    policy: 'provvy_only',
    label: 'Link expiry',
    note: 'Provvy-only; not exported to accounting.',
  },
  attachment: {
    policy: 'provvy_only',
    label: 'Attachment',
    note: 'Provvy-only; not exported to accounting.',
  },
};

export function policyRequiresAccountingResync(field: AccountingEditableField): boolean {
  const entry = ACCOUNTING_EDIT_FIELD_POLICY[field];
  return entry.policy === 'update_accounting' || entry.policy === 'manual_resync';
}

export function policyShowsWarning(field: AccountingEditableField): boolean {
  const entry = ACCOUNTING_EDIT_FIELD_POLICY[field];
  return (
    entry.policy === 'manual_resync' ||
    entry.policy === 'update_accounting' ||
    entry.policy === 'display_warning'
  );
}

export function fieldsRequiringResync(changedFields: AccountingEditableField[]): AccountingEditableField[] {
  return changedFields.filter(policyRequiresAccountingResync);
}
