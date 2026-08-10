/**
 * UX helpers for synced invoice removal — display-only, no accounting behaviour.
 */

import { resolveInvoiceRemovalOptions } from '@/lib/accounting/accounting-invoice-deletion-policy';
import type { AccountingInvoiceSyncRow } from '@/lib/accounting/accounting-push-state';

export type XeroSyncForRemovalUx = {
  syncType: string;
  status: string;
};

const PAID_INVOICE_STATUSES = new Set(['PAID', 'PAID_UNVERIFIED', 'REQUIRES_REVIEW']);

export function hasSuccessfulPaymentSync(
  syncs: XeroSyncForRemovalUx[] | null | undefined
): boolean {
  return (
    syncs?.some((s) => s.syncType === 'PAYMENT' && s.status === 'SUCCESS') ?? false
  );
}

/** True when the invoice has payment activity relevant to void warnings. */
export function shouldShowPaidVoidWarning(input: {
  status: string;
  xeroSyncs?: XeroSyncForRemovalUx[] | null;
}): boolean {
  if (PAID_INVOICE_STATUSES.has(input.status)) return true;
  return hasSuccessfulPaymentSync(input.xeroSyncs);
}

export function isFullyPaidInvoiceStatus(status: string): boolean {
  return status === 'PAID';
}

export function canShowVoidRemovalOption(input: {
  status: string;
  invoiceSync?: AccountingInvoiceSyncRow | null;
}): boolean {
  return resolveInvoiceRemovalOptions(input).canVoid;
}

export type AccountingConsequenceStep = {
  label: string;
  value: string;
};

export type AccountingConsequenceFlow = {
  steps: AccountingConsequenceStep[];
  footer: string;
};

export function voidInvoiceConsequenceFlow(): AccountingConsequenceFlow {
  return {
    steps: [
      { label: 'Provvy', value: 'Cancelled' },
      { label: 'Accounting', value: 'Voided' },
    ],
    footer: 'Commercial history retained',
  };
}

export function archiveInvoiceConsequenceFlow(): AccountingConsequenceFlow {
  return {
    steps: [
      { label: 'Provvy', value: 'Archived' },
      { label: 'Accounting', value: 'No changes' },
    ],
    footer: 'Commercial history retained',
  };
}
