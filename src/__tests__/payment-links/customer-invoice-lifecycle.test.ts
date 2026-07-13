/**
 * Immediate Invoice Export — customer invoice lifecycle tests.
 */

import {
  CustomerInvoiceLifecycleState,
  buildCustomerInvoiceLifecycleSnapshot,
  buildCustomerInvoiceLifecycleTimeline,
  deriveCustomerInvoiceLifecycleState,
  deriveInvoicesByRecognitionPeriodSlice,
  deriveOutstandingReceivablesReportSlice,
} from '@/lib/payment-links/customer-invoice-lifecycle';
import {
  resolveXeroInvoiceDates,
} from '@/lib/payment-links/invoice-commercial-timing-export';
import { resolveInvoiceCommercialTiming } from '@/lib/commercial-timing';

const BASE_INPUT = {
  linkStatus: 'OPEN' as const,
  invoiceAmount: 1000,
  amountPaid: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('customer invoice lifecycle state', () => {
  it('starts as ISSUED when created and not yet exported', () => {
    expect(
      deriveCustomerInvoiceLifecycleState({
        ...BASE_INPUT,
        invoiceSync: null,
      })
    ).toBe(CustomerInvoiceLifecycleState.ISSUED);
  });

  it('becomes OUTSTANDING after export while awaiting payment', () => {
    expect(
      deriveCustomerInvoiceLifecycleState({
        ...BASE_INPUT,
        invoiceSync: {
          syncType: 'INVOICE',
          status: 'SUCCESS',
          xeroInvoiceId: 'xero-inv-1',
        },
      })
    ).toBe(CustomerInvoiceLifecycleState.OUTSTANDING);
  });

  it('becomes PAID when fully paid — preserves invoice identity via same link', () => {
    expect(
      deriveCustomerInvoiceLifecycleState({
        ...BASE_INPUT,
        linkStatus: 'PAID',
        amountPaid: 1000,
        invoiceSync: {
          syncType: 'INVOICE',
          status: 'SUCCESS',
          xeroInvoiceId: 'xero-inv-1',
        },
        paymentSync: {
          syncType: 'PAYMENT',
          status: 'SUCCESS',
          xeroPaymentId: 'xero-pay-1',
        },
      })
    ).toBe(CustomerInvoiceLifecycleState.PAID);
  });

  it('supports PARTIALLY_PAID when amount paid is less than invoice total', () => {
    expect(
      deriveCustomerInvoiceLifecycleState({
        ...BASE_INPUT,
        amountPaid: 400,
        invoiceSync: {
          syncType: 'INVOICE',
          status: 'SUCCESS',
          xeroInvoiceId: 'xero-inv-1',
        },
      })
    ).toBe(CustomerInvoiceLifecycleState.PARTIALLY_PAID);
  });

  it('marks CANCELLED for expired or canceled links', () => {
    expect(
      deriveCustomerInvoiceLifecycleState({
        ...BASE_INPUT,
        linkStatus: 'CANCELED',
        invoiceSync: null,
      })
    ).toBe(CustomerInvoiceLifecycleState.CANCELLED);
  });
});

describe('invoice exported before payment timeline', () => {
  it('shows export step reached before payment step', () => {
    const timeline = buildCustomerInvoiceLifecycleTimeline({
      ...BASE_INPUT,
      exportedAt: new Date('2026-01-02T00:00:00.000Z'),
      invoiceSync: {
        syncType: 'INVOICE',
        status: 'SUCCESS',
        xeroInvoiceId: 'xero-inv-1',
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    });

    const exported = timeline.find((s) => s.id === 'exported');
    const payment = timeline.find((s) => s.id === 'payment_received');
    expect(exported?.reached).toBe(true);
    expect(payment?.reached).toBe(false);
  });

  it('follows merchant narrative order', () => {
    const snapshot = buildCustomerInvoiceLifecycleSnapshot({
      ...BASE_INPUT,
      linkStatus: 'PAID',
      amountPaid: 1000,
      exportedAt: new Date('2026-01-02T00:00:00.000Z'),
      paymentConfirmedAt: new Date('2026-01-10T00:00:00.000Z'),
      settlementReadyAt: new Date('2026-01-11T00:00:00.000Z'),
      invoiceSync: {
        syncType: 'INVOICE',
        status: 'SUCCESS',
        xeroInvoiceId: 'xero-inv-1',
      },
    });

    const labels = snapshot.timeline.filter((s) => s.reached).map((s) => s.label);
    expect(labels).toEqual([
      'Invoice Created',
      'Invoice Exported',
      'Payment Received',
      'Commercially Reconciled',
      'Invoice Paid',
      'Settlement Ready',
    ]);
  });
});

describe('commercial timing in export', () => {
  it('inherits agreement timing for Xero date resolution', () => {
    const resolved = resolveInvoiceCommercialTiming(
      {
        servicePeriodStart: '2026-03-01T00:00:00.000Z',
        servicePeriodEnd: '2026-03-31T00:00:00.000Z',
        recognitionPeriod: { year: 2026, month: 3 },
        expectedPaymentDate: '2026-04-15T00:00:00.000Z',
      },
      null
    );

    const dates = resolveXeroInvoiceDates({
      invoiceDate: new Date('2026-03-05T00:00:00.000Z'),
      dueDate: null,
      commercialTiming: resolved,
    });

    expect(dates.date).toBe('2026-03-05');
    expect(dates.dueDate).toBe('2026-04-15');
  });

  it('falls back to service period start when invoice_date is unset', () => {
    const resolved = resolveInvoiceCommercialTiming(
      { servicePeriodStart: '2026-06-01T00:00:00.000Z' },
      null
    );
    const dates = resolveXeroInvoiceDates({
      invoiceDate: null,
      dueDate: null,
      commercialTiming: resolved,
    });
    expect(dates.date).toBe('2026-06-01');
  });
});

describe('reporting extension points', () => {
  it('exposes outstanding receivables placeholder', () => {
    const lifecycle = buildCustomerInvoiceLifecycleSnapshot({
      ...BASE_INPUT,
      invoiceSync: {
        syncType: 'INVOICE',
        status: 'SUCCESS',
        xeroInvoiceId: 'x1',
      },
    });
    const slice = deriveOutstandingReceivablesReportSlice({
      lifecycle,
      commercialTiming: resolveInvoiceCommercialTiming(
        { recognitionPeriod: { year: 2026, month: 4 } },
        null
      ),
      currency: 'AUD',
    });
    expect(slice.status).toBe('not_implemented');
    expect(slice.filters.recognitionPeriod).toBe('2026-04');
  });
});

describe('backwards compatibility', () => {
  it('legacy links without xero sync remain ISSUED', () => {
    const snapshot = buildCustomerInvoiceLifecycleSnapshot({
      ...BASE_INPUT,
      invoiceSync: null,
    });
    expect(snapshot.exportedToAccounting).toBe(false);
    expect(snapshot.state).toBe(CustomerInvoiceLifecycleState.ISSUED);
  });

  it('legacy paid links without export history still reach PAID state', () => {
    expect(
      deriveCustomerInvoiceLifecycleState({
        ...BASE_INPUT,
        linkStatus: 'PAID',
        amountPaid: 1000,
        invoiceSync: null,
      })
    ).toBe(CustomerInvoiceLifecycleState.PAID);
  });
});
