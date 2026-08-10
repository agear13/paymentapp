/**
 * Deletion / removal policy for accounting-synced commercial invoices.
 * Provvy is the system of record; hard delete must not orphan accounting records.
 */

import { isAccountingInvoiceExported, type AccountingInvoiceSyncRow } from '@/lib/accounting/accounting-push-state';

export type InvoiceRemovalAction = 'delete' | 'void' | 'archive';

export type InvoiceRemovalOptions = {
  canHardDelete: boolean;
  canVoid: boolean;
  canArchive: boolean;
  requiresAccountingDialog: boolean;
  blockReason: string | null;
};

export function isInvoiceVoidedInAccounting(responsePayload: unknown): boolean {
  if (!responsePayload || typeof responsePayload !== 'object') return false;
  return Boolean((responsePayload as Record<string, unknown>).voidedAt);
}

export function resolveInvoiceRemovalOptions(input: {
  status: string;
  invoiceSync?: AccountingInvoiceSyncRow | null;
  hasPaymentEvidence?: boolean;
}): InvoiceRemovalOptions {
  const exported = isAccountingInvoiceExported(input.invoiceSync ?? null);
  const voided = isInvoiceVoidedInAccounting(input.invoiceSync?.responsePayload);
  const isPaid = input.status === 'PAID';
  const isCancelable =
    input.status !== 'PAID' && input.status !== 'EXPIRED' && input.status !== 'CANCELED';
  const isDeletableStatus = ['DRAFT', 'OPEN', 'CANCELED'].includes(input.status);

  if (exported) {
    return {
      canHardDelete: false,
      canVoid: isCancelable && !voided && !isPaid,
      canArchive: isCancelable && !isPaid,
      requiresAccountingDialog: true,
      blockReason:
        'This invoice has already been synced to your accounting software and cannot be permanently deleted.',
    };
  }

  if (isPaid) {
    return {
      canHardDelete: false,
      canVoid: false,
      canArchive: false,
      requiresAccountingDialog: false,
      blockReason: 'Paid invoices cannot be deleted.',
    };
  }

  if (!isDeletableStatus) {
    return {
      canHardDelete: false,
      canVoid: false,
      canArchive: false,
      requiresAccountingDialog: false,
      blockReason: `Only draft, open, or canceled invoices can be deleted (current status: ${input.status}).`,
    };
  }

  if (input.status !== 'DRAFT' && input.hasPaymentEvidence) {
    return {
      canHardDelete: false,
      canVoid: false,
      canArchive: isCancelable,
      requiresAccountingDialog: false,
      blockReason:
        'Cannot delete because payment or settlement evidence exists on this invoice. Cancel or archive instead.',
    };
  }

  return {
    canHardDelete: true,
    canVoid: false,
    canArchive: isCancelable,
    requiresAccountingDialog: false,
    blockReason: null,
  };
}
