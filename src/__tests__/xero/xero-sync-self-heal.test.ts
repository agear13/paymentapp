import {
  canAutoRecoverPaymentSync,
  getXeroSyncDisplayStatus,
  isInvoiceExportPending,
  isWaitingForInvoiceExportError,
} from '@/lib/xero/xero-sync-display';
import {
  CASH_CUSTOMER_NAME,
  PROVVYPAY_CASH_CONTACT_NUMBER,
  isCashCustomerContact,
  provvypayContactNumber,
} from '@/lib/xero/xero-contact-service';
import { categorizeError } from '@/lib/xero/queue-service';

describe('xero-sync-display', () => {
  it('shows waiting state when payment sync runs before invoice export', () => {
    const invoiceSync = { syncType: 'INVOICE', status: 'PENDING', errorMessage: null };
    const paymentSync = {
      syncType: 'PAYMENT',
      status: 'RETRYING',
      errorMessage: 'Xero invoice not found for this payment link. Sync invoice first.',
    };

    expect(canAutoRecoverPaymentSync(paymentSync, invoiceSync)).toBe(true);

    const display = getXeroSyncDisplayStatus(paymentSync, [invoiceSync, paymentSync]);
    expect(display.label).toBe('Waiting for invoice export');
    expect(display.isProgress).toBe(true);
    expect(display.variant).not.toBe('destructive');
  });

  it('shows success when payment sync completed', () => {
    const paymentSync = {
      syncType: 'PAYMENT',
      status: 'SUCCESS',
      xeroPaymentId: 'pay-1',
      errorMessage: null,
    };
    const display = getXeroSyncDisplayStatus(paymentSync, [
      { syncType: 'INVOICE', status: 'SUCCESS', xeroInvoiceId: 'inv-1' },
      paymentSync,
    ]);
    expect(display.label).toBe('SUCCESS');
    expect(display.variant).toBe('success');
  });

  it('detects invoice export pending when no invoice sync exists', () => {
    expect(isInvoiceExportPending(undefined)).toBe(true);
    expect(isInvoiceExportPending({ syncType: 'INVOICE', status: 'SUCCESS', xeroInvoiceId: 'x' })).toBe(
      false
    );
  });

  it('recognises legacy invoice-not-found errors as recoverable', () => {
    expect(isWaitingForInvoiceExportError('Sync invoice first')).toBe(true);
    expect(categorizeError('Xero invoice not found for this payment link. Sync invoice first.')).toEqual({
      type: 'INVOICE_PENDING',
      retryable: true,
    });
  });
});

describe('xero-contact-service helpers', () => {
  it('uses stable external id for Cash Customer', () => {
    expect(provvypayContactNumber(CASH_CUSTOMER_NAME)).toBe(PROVVYPAY_CASH_CONTACT_NUMBER);
    expect(isCashCustomerContact(CASH_CUSTOMER_NAME)).toBe(true);
    expect(isCashCustomerContact('guest@example.com')).toBe(false);
  });

  it('builds contact number from email', () => {
    expect(provvypayContactNumber('Guest@Example.com')).toBe('PROVVYPAY_guest@example.com');
  });
});

describe('xero sync self-heal contract', () => {
  it('ensureXeroInvoiceForPayment is exported from sync orchestration', async () => {
    const mod = await import('@/lib/xero/sync-orchestration');
    expect(typeof mod.ensureXeroInvoiceForPayment).toBe('function');
    expect(typeof mod.syncPaymentToXero).toBe('function');
  });
});
