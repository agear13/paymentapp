/**
 * Xero sync status display helpers for merchant UI.
 */

export type XeroSyncRecordLike = {
  syncType: string;
  status: string;
  errorMessage?: string | null;
  xeroInvoiceId?: string | null;
  xeroPaymentId?: string | null;
};

const INVOICE_WAIT_PATTERNS = [
  /sync invoice first/i,
  /xero invoice not found/i,
  /invoice not found for this payment/i,
  /waiting for invoice export/i,
];

export function isInvoiceExportPending(
  invoiceSync: XeroSyncRecordLike | null | undefined
): boolean {
  if (!invoiceSync) return true;
  if (invoiceSync.status === 'SUCCESS' && invoiceSync.xeroInvoiceId) return false;
  return invoiceSync.status === 'PENDING' || invoiceSync.status === 'RETRYING';
}

export function isWaitingForInvoiceExportError(errorMessage: string | null | undefined): boolean {
  if (!errorMessage) return false;
  return INVOICE_WAIT_PATTERNS.some((pattern) => pattern.test(errorMessage));
}

export function canAutoRecoverPaymentSync(
  paymentSync: XeroSyncRecordLike,
  invoiceSync: XeroSyncRecordLike | null | undefined
): boolean {
  if (paymentSync.syncType !== 'PAYMENT') return false;
  if (paymentSync.status === 'SUCCESS') return false;
  if (isInvoiceExportPending(invoiceSync)) return true;
  return isWaitingForInvoiceExportError(paymentSync.errorMessage);
}

export type XeroSyncDisplayStatus = {
  label: string;
  variant: 'success' | 'destructive' | 'default' | 'secondary';
  detail: string | null;
  isProgress: boolean;
};

export function getXeroSyncDisplayStatus(
  sync: XeroSyncRecordLike,
  allSyncs: XeroSyncRecordLike[]
): XeroSyncDisplayStatus {
  const invoiceSync = allSyncs.find((s) => s.syncType === 'INVOICE');

  if (
    sync.syncType === 'PAYMENT' &&
    canAutoRecoverPaymentSync(sync, invoiceSync)
  ) {
    return {
      label: 'Waiting for invoice export',
      variant: sync.status === 'RETRYING' || sync.status === 'PENDING' ? 'default' : 'secondary',
      detail:
        'Payment sync will continue automatically once the invoice is exported to Xero.',
      isProgress: true,
    };
  }

  if (sync.status === 'SUCCESS') {
    return {
      label: 'SUCCESS',
      variant: 'success',
      detail: null,
      isProgress: false,
    };
  }

  if (sync.status === 'FAILED') {
    return {
      label: 'FAILED',
      variant: 'destructive',
      detail: sync.errorMessage ?? null,
      isProgress: false,
    };
  }

  if (sync.status === 'RETRYING') {
    return {
      label: 'RETRYING',
      variant: 'default',
      detail: sync.errorMessage ?? 'Retry scheduled',
      isProgress: true,
    };
  }

  return {
    label: sync.status,
    variant: 'secondary',
    detail: sync.errorMessage ?? null,
    isProgress: sync.status === 'PENDING',
  };
}
