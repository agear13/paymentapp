import {
  isInvoiceVoidedInAccounting,
  resolveInvoiceRemovalOptions,
} from '@/lib/accounting/accounting-invoice-deletion-policy';

const exportedSync = {
  syncType: 'INVOICE',
  status: 'SUCCESS',
  xeroInvoiceId: 'xero-inv-1',
  responsePayload: { xeroInvoiceNumber: 'INV-001' },
};

describe('accounting invoice deletion policy', () => {
  describe('unsynced invoice', () => {
    it('allows hard delete for draft invoices', () => {
      const options = resolveInvoiceRemovalOptions({
        status: 'DRAFT',
        invoiceSync: null,
      });
      expect(options.canHardDelete).toBe(true);
      expect(options.requiresAccountingDialog).toBe(false);
      expect(options.canVoid).toBe(false);
      expect(options.canArchive).toBe(true);
    });

    it('allows hard delete for open invoices without payment evidence', () => {
      const options = resolveInvoiceRemovalOptions({
        status: 'OPEN',
        invoiceSync: null,
        hasPaymentEvidence: false,
      });
      expect(options.canHardDelete).toBe(true);
      expect(options.requiresAccountingDialog).toBe(false);
    });

    it('blocks hard delete when payment evidence exists on non-draft invoices', () => {
      const options = resolveInvoiceRemovalOptions({
        status: 'OPEN',
        invoiceSync: null,
        hasPaymentEvidence: true,
      });
      expect(options.canHardDelete).toBe(false);
      expect(options.canArchive).toBe(true);
      expect(options.blockReason).toMatch(/payment or settlement evidence/i);
    });
  });

  describe('synced invoice', () => {
    it('blocks hard delete and requires accounting dialog', () => {
      const options = resolveInvoiceRemovalOptions({
        status: 'OPEN',
        invoiceSync: exportedSync,
      });
      expect(options.canHardDelete).toBe(false);
      expect(options.requiresAccountingDialog).toBe(true);
      expect(options.blockReason).toMatch(/synced to your accounting software/i);
    });

    it('offers void and archive for synced open invoices', () => {
      const options = resolveInvoiceRemovalOptions({
        status: 'OPEN',
        invoiceSync: exportedSync,
      });
      expect(options.canVoid).toBe(true);
      expect(options.canArchive).toBe(true);
    });

    it('offers archive but not void for synced canceled invoices', () => {
      const options = resolveInvoiceRemovalOptions({
        status: 'CANCELED',
        invoiceSync: exportedSync,
      });
      expect(options.canHardDelete).toBe(false);
      expect(options.canVoid).toBe(false);
      expect(options.canArchive).toBe(false);
    });

    it('blocks all removal actions for paid synced invoices', () => {
      const options = resolveInvoiceRemovalOptions({
        status: 'PAID',
        invoiceSync: exportedSync,
      });
      expect(options.canHardDelete).toBe(false);
      expect(options.canVoid).toBe(false);
      expect(options.canArchive).toBe(false);
      expect(options.requiresAccountingDialog).toBe(true);
    });
  });

  describe('voided invoice', () => {
    it('detects voided state from response payload', () => {
      expect(
        isInvoiceVoidedInAccounting({ voidedAt: '2026-01-15T10:00:00.000Z' })
      ).toBe(true);
      expect(isInvoiceVoidedInAccounting({ xeroInvoiceNumber: 'INV-1' })).toBe(false);
      expect(isInvoiceVoidedInAccounting(null)).toBe(false);
    });

    it('disallows void when already voided in accounting', () => {
      const options = resolveInvoiceRemovalOptions({
        status: 'OPEN',
        invoiceSync: {
          ...exportedSync,
          responsePayload: { voidedAt: '2026-01-15T10:00:00.000Z' },
        },
      });
      expect(options.canVoid).toBe(false);
      expect(options.canArchive).toBe(true);
    });
  });

  describe('archived invoice', () => {
    it('allows hard delete for canceled unsynced invoices', () => {
      const options = resolveInvoiceRemovalOptions({
        status: 'CANCELED',
        invoiceSync: null,
      });
      expect(options.canHardDelete).toBe(true);
      expect(options.canArchive).toBe(false);
    });
  });

  describe('unsafe behaviour guard', () => {
    it('never allows hard delete when accounting export succeeded', () => {
      for (const status of ['DRAFT', 'OPEN', 'CANCELED']) {
        const options = resolveInvoiceRemovalOptions({
          status,
          invoiceSync: exportedSync,
        });
        expect(options.canHardDelete).toBe(false);
      }
    });
  });
});
