import {
  buildHistoricalSyncPreview,
  classifyHistoricalSyncNeeds,
  historicalSyncBannerMessage,
  historicalSyncStatusLabel,
  isInvoiceSyncSuccess,
  isPaymentSyncSuccess,
  selectHistoricalSyncItems,
  syncTypesToQueueForItem,
} from '@/lib/accounting/historical-accounting-sync';

function link(overrides) {
  return {
    id: overrides.id,
    status: overrides.status,
    short_code: overrides.short_code ?? 'ABC12345',
    invoice_reference: overrides.invoice_reference ?? null,
    customer_name: overrides.customer_name ?? null,
    customer_email: overrides.customer_email ?? null,
    invoice_date: overrides.invoice_date ?? null,
    created_at: overrides.created_at ?? '2026-01-15T00:00:00.000Z',
    amount: overrides.amount ?? 100,
    invoice_currency: overrides.invoice_currency ?? 'AUD',
    currency: overrides.currency ?? 'AUD',
    settlement_amount: overrides.settlement_amount ?? null,
    xero_syncs: overrides.xero_syncs ?? [],
  };
}

describe('historical accounting sync', () => {
  describe('classifyHistoricalSyncNeeds', () => {
    it('excludes draft and canceled invoices', () => {
      expect(
        classifyHistoricalSyncNeeds(link({ id: '1', status: 'DRAFT' }), []).included
      ).toBe(false);
      expect(
        classifyHistoricalSyncNeeds(link({ id: '2', status: 'CANCELED' }), []).included
      ).toBe(false);
    });

    it('finds open invoices missing invoice sync', () => {
      const needs = classifyHistoricalSyncNeeds(link({ id: '1', status: 'OPEN' }), []);
      expect(needs.included).toBe(true);
      expect(needs.needsInvoiceSync).toBe(true);
      expect(needs.needsPaymentSync).toBe(false);
    });

    it('finds paid invoices missing payment sync', () => {
      const needs = classifyHistoricalSyncNeeds(
        link({ id: '1', status: 'PAID', settlement_amount: 100 }),
        [{ sync_type: 'INVOICE', status: 'SUCCESS', xero_invoice_id: 'inv-1' }]
      );
      expect(needs.included).toBe(true);
      expect(needs.needsInvoiceSync).toBe(false);
      expect(needs.needsPaymentSync).toBe(true);
      expect(needs.needsSettlementExport).toBe(true);
    });

    it('ignores already synced invoices', () => {
      const needs = classifyHistoricalSyncNeeds(
        link({ id: '1', status: 'PAID' }),
        [
          { sync_type: 'INVOICE', status: 'SUCCESS', xero_invoice_id: 'inv-1' },
          { sync_type: 'PAYMENT', status: 'SUCCESS', xero_payment_id: 'pay-1' },
        ]
      );
      expect(needs.included).toBe(false);
    });
  });

  describe('buildHistoricalSyncPreview', () => {
    it('returns empty preview when no historical invoices need sync', () => {
      const preview = buildHistoricalSyncPreview(
        [
          link({ id: 'draft', status: 'DRAFT' }),
          link({
            id: 'synced',
            status: 'PAID',
            xero_syncs: [
              { sync_type: 'INVOICE', status: 'SUCCESS', xero_invoice_id: 'inv-1' },
              { sync_type: 'PAYMENT', status: 'SUCCESS', xero_payment_id: 'pay-1' },
            ],
          }),
        ],
        (amount, currency) => `${amount} ${currency}`
      );

      expect(preview.totalUnsynced).toBe(0);
      expect(preview.items).toEqual([]);
    });

    it('finds historical invoices awaiting sync', () => {
      const preview = buildHistoricalSyncPreview(
        [
          link({
            id: 'open-1',
            status: 'OPEN',
            invoice_reference: 'INV-001',
            customer_name: 'Acme Co',
          }),
          link({
            id: 'paid-1',
            status: 'PAID',
            settlement_amount: 250,
            xero_syncs: [
              { sync_type: 'INVOICE', status: 'SUCCESS', xero_invoice_id: 'inv-2' },
            ],
          }),
        ],
        (amount, currency) => `${amount} ${currency}`
      );

      expect(preview.totalUnsynced).toBe(2);
      expect(preview.invoiceSyncCount).toBe(1);
      expect(preview.paymentSyncCount).toBe(1);
      expect(preview.settlementExportCount).toBe(1);
      expect(preview.items[0]?.invoiceNumber).toBe('INV-001');
      expect(preview.items[0]?.customer).toBe('Acme Co');
      expect(preview.items[1]?.syncStatus).toBe('Settlement awaiting export');
    });
  });

  describe('selectHistoricalSyncItems', () => {
    const preview = buildHistoricalSyncPreview(
      [
        link({ id: 'a', status: 'OPEN' }),
        link({ id: 'b', status: 'OPEN' }),
        link({ id: 'c', status: 'OPEN' }),
      ],
      (amount, currency) => `${amount} ${currency}`
    );

    it('sync all selects every unsynced item', () => {
      const selected = selectHistoricalSyncItems(preview, { syncAll: true });
      expect(selected).toHaveLength(3);
    });

    it('sync selected returns only chosen ids', () => {
      const selected = selectHistoricalSyncItems(preview, {
        paymentLinkIds: ['a', 'c'],
      });
      expect(selected.map((item) => item.paymentLinkId)).toEqual(['a', 'c']);
    });
  });

  describe('syncTypesToQueueForItem', () => {
    it('queues invoice and payment when both are needed', () => {
      expect(
        syncTypesToQueueForItem({
          paymentLinkId: '1',
          invoiceNumber: 'INV-1',
          customer: null,
          date: '2026-01-01',
          amount: '100 AUD',
          currency: 'AUD',
          status: 'PAID',
          syncStatus: 'Not synced',
          needsInvoiceSync: true,
          needsPaymentSync: true,
          needsSettlementExport: false,
        })
      ).toEqual(['INVOICE', 'PAYMENT']);
    });
  });

  describe('sync success helpers', () => {
    it('requires xero invoice id for invoice success', () => {
      expect(
        isInvoiceSyncSuccess({ sync_type: 'INVOICE', status: 'SUCCESS', xero_invoice_id: null })
      ).toBe(false);
      expect(
        isInvoiceSyncSuccess({ sync_type: 'INVOICE', status: 'SUCCESS', xero_invoice_id: 'x' })
      ).toBe(true);
    });

    it('treats payment success without external id check', () => {
      expect(isPaymentSyncSuccess({ sync_type: 'PAYMENT', status: 'SUCCESS' })).toBe(true);
    });
  });

  describe('labels', () => {
    it('formats banner message for singular and plural counts', () => {
      expect(historicalSyncBannerMessage(1)).toContain('1 invoice');
      expect(historicalSyncBannerMessage(15)).toContain('15 invoices');
    });

    it('describes composite sync status', () => {
      expect(
        historicalSyncStatusLabel({
          needsInvoiceSync: true,
          needsPaymentSync: true,
          needsSettlementExport: false,
        })
      ).toBe('Not synced');
    });
  });
});
