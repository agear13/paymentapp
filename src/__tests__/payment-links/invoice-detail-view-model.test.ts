import {
  buildInvoiceActivityTimeline,
  deriveInvoiceAccountingDisplayState,
  deriveInvoiceDetailViewModel,
  deriveInvoiceNextStep,
  deriveMerchantPaymentLifecycleHealthLabel,
  deriveSendInvoiceCtaLabel,
  deriveSidebarInvoiceLabel,
  filterMerchantPaymentLifecycleTimeline,
  hasInvoiceBeenSent,
  paymentEventMerchantLabel,
  shouldShowPaymentLifecycleAccountingNote,
} from '@/lib/payment-links/invoice-detail-view-model';
import {
  toInvoiceDisplayStatus,
  toPaymentDisplayStatus,
} from '@/lib/payment-links/invoice-display-status';

const baseDetail = {
  id: 'plink-1',
  status: 'OPEN',
  amount: 1000,
  currency: 'AUD',
  description: 'Consulting',
  createdAt: '2026-08-13T10:00:00.000Z',
  updatedAt: '2026-08-13T10:00:00.000Z',
  paymentMethod: 'STRIPE',
};

const connectedReady = { connected: true, syncReady: true };
const notConnected = { connected: false, syncReady: false };

describe('invoice display status', () => {
  it('shows Unsent for open invoices that have never been emailed', () => {
    expect(toInvoiceDisplayStatus({ status: 'OPEN' })).toBe('Unsent');
  });

  it('shows Sent only after lastSentAt is set', () => {
    expect(
      toInvoiceDisplayStatus({
        status: 'OPEN',
        lastSentAt: '2026-08-14T09:00:00.000Z',
      })
    ).toBe('Sent');
  });
});

describe('deriveInvoiceAccountingDisplayState', () => {
  it('returns not_connected when accounting is disconnected', () => {
    expect(
      deriveInvoiceAccountingDisplayState({
        accountingConnection: notConnected,
        invoiceSync: { syncType: 'INVOICE', status: 'PENDING' },
      })
    ).toBe('not_connected');
  });

  it('returns not_synced when connected but invoice never pushed', () => {
    expect(
      deriveInvoiceAccountingDisplayState({
        accountingConnection: connectedReady,
        invoiceSync: null,
      })
    ).toBe('not_synced');
  });

  it('returns sync_pending when invoice export is in progress', () => {
    expect(
      deriveInvoiceAccountingDisplayState({
        accountingConnection: connectedReady,
        invoiceSync: { syncType: 'INVOICE', status: 'PENDING' },
      })
    ).toBe('sync_pending');
  });

  it('returns synced when invoice export succeeded', () => {
    expect(
      deriveInvoiceAccountingDisplayState({
        accountingConnection: connectedReady,
        invoiceSync: {
          syncType: 'INVOICE',
          status: 'SUCCESS',
          xeroInvoiceId: 'xero-inv-1',
        },
      })
    ).toBe('synced');
  });
});

describe('deriveInvoiceDetailViewModel', () => {
  it('derives send-invoice next step for unsent open invoices', () => {
    const vm = deriveInvoiceDetailViewModel({
      detail: baseDetail,
      lifecycle: null,
      accountingConnection: notConnected,
    });

    expect(vm.displayStatus).toBe('Unsent');
    expect(vm.hasBeenSent).toBe(false);
    expect(vm.nextStep?.kind).toBe('send_invoice');
    expect(vm.accountingState).toBe('not_connected');
    expect(vm.showAccountingSyncDetails).toBe(false);
    expect(vm.settlementSummaryLabel).toBe('Awaiting payment');
  });

  it('derives sent state and no send next step after email delivery', () => {
    const vm = deriveInvoiceDetailViewModel({
      detail: {
        ...baseDetail,
        lastSentAt: '2026-08-14T09:00:00.000Z',
        lastSentToEmail: 'client@example.com',
      },
      lifecycle: null,
      accountingConnection: notConnected,
    });

    expect(vm.displayStatus).toBe('Sent');
    expect(vm.hasBeenSent).toBe(true);
    expect(vm.nextStep?.kind).toBe('accounting_connect');
  });

  it('derives unpaid payment status for open invoices', () => {
    const vm = deriveInvoiceDetailViewModel({
      detail: baseDetail,
      lifecycle: {
        invoiceLifecycle: {
          state: 'OUTSTANDING',
          stateLabel: 'Awaiting Payment',
          amountPaid: 0,
          amountOutstanding: 1000,
          timeline: [],
        },
      },
      accountingConnection: connectedReady,
    });

    expect(toPaymentDisplayStatus(baseDetail, 1000, 1000)).toBe('Unpaid');
    expect(vm.payStatus).toBe('Unpaid');
  });

  it('derives paid and manual settlement labels', () => {
    const vm = deriveInvoiceDetailViewModel({
      detail: {
        ...baseDetail,
        status: 'PAID',
        paidAt: '2026-08-15T12:00:00.000Z',
      },
      lifecycle: {
        invoiceLifecycle: {
          state: 'PAID',
          stateLabel: 'Invoice Paid',
          amountPaid: 1000,
          amountOutstanding: 0,
          timeline: [],
        },
      },
      accountingConnection: connectedReady,
    });

    expect(vm.displayStatus).toBe('Paid');
    expect(vm.isPaid).toBe(true);
    expect(vm.payStatus).toBe('Settled');
    expect(vm.settlementSummaryLabel).toBe('Payment received');
    expect(vm.nextStep?.kind).toBe('accounting_action');
  });

  it('hides accounting sync UI details when accounting is not connected', () => {
    const vm = deriveInvoiceDetailViewModel({
      detail: {
        ...baseDetail,
        xeroSyncs: [{ syncType: 'INVOICE', status: 'PENDING' }],
      },
      lifecycle: null,
      accountingConnection: notConnected,
    });

    expect(vm.accountingStatusLabel).toBe('Accounting not connected');
    expect(vm.showAccountingSyncDetails).toBe(false);
  });
});

describe('buildInvoiceActivityTimeline ordering', () => {
  it('orders events chronologically oldest first', () => {
    const timeline = buildInvoiceActivityTimeline(
      {
        ...baseDetail,
        paymentEvents: [
          {
            id: 'e2',
            eventType: 'PAYMENT_INITIATED',
            createdAt: '2026-08-13T10:00:01.000Z',
          },
          {
            id: 'e1',
            eventType: 'CREATED',
            createdAt: '2026-08-13T10:00:00.000Z',
          },
        ],
      },
      {
        invoiceLifecycle: {
          state: 'ISSUED',
          stateLabel: 'Invoice Created',
          amountPaid: 0,
          amountOutstanding: 1000,
          timeline: [
            {
              id: 'created',
              state: 'ISSUED',
              label: 'Invoice Created',
              reached: true,
              occurredAt: '2026-08-13T10:00:00.000Z',
            },
          ],
        },
      }
    );

    expect(timeline.map((entry) => entry.label)).toEqual([
      'Invoice created',
      'Payment link ready',
    ]);
  });

  it('deduplicates semantically equivalent invoice created events', () => {
    const timeline = buildInvoiceActivityTimeline(
      {
        ...baseDetail,
        paymentEvents: [
          {
            id: 'e-created-late',
            eventType: 'CREATED',
            createdAt: '2026-08-13T13:55:00.000Z',
          },
          {
            id: 'e-init',
            eventType: 'PAYMENT_INITIATED',
            createdAt: '2026-08-13T13:54:00.000Z',
          },
        ],
      },
      {
        invoiceLifecycle: {
          state: 'OUTSTANDING',
          stateLabel: 'Awaiting Payment',
          amountPaid: 0,
          amountOutstanding: 1000,
          timeline: [
            {
              id: 'created',
              state: 'ISSUED',
              label: 'Invoice Created',
              reached: true,
              occurredAt: '2026-08-13T12:53:00.000Z',
            },
          ],
        },
      }
    );

    expect(timeline.map((entry) => entry.label)).toEqual([
      'Invoice created',
      'Payment link ready',
    ]);
  });

  it('adds invoice sent from lastSentAt without inventing timestamps', () => {
    const timeline = buildInvoiceActivityTimeline(
      {
        ...baseDetail,
        lastSentAt: '2026-08-14T09:00:00.000Z',
        lastSentToEmail: 'client@example.com',
        paymentEvents: [
          {
            id: 'e1',
            eventType: 'CREATED',
            createdAt: '2026-08-13T10:00:00.000Z',
          },
        ],
      },
      null
    );

    const sentEntry = timeline.find((entry) => entry.label === 'Invoice sent');
    expect(sentEntry).toBeDefined();
    expect(sentEntry?.sortAt).toBe(new Date('2026-08-14T09:00:00.000Z').getTime());
    expect(sentEntry?.detail).toBe('to client@example.com');
  });

  it('does not add invoice sent when lastSentAt is absent', () => {
    const timeline = buildInvoiceActivityTimeline(baseDetail, null);
    expect(timeline.some((entry) => entry.label === 'Invoice sent')).toBe(false);
  });

  it('labels PAYMENT_INITIATED as payment link ready for unpaid invoices', () => {
    expect(paymentEventMerchantLabel('PAYMENT_INITIATED', 'OPEN')).toBe('Payment link ready');
  });
});

describe('deriveInvoiceNextStep', () => {
  it('prioritises send over accounting connect for unsent invoices', () => {
    const next = deriveInvoiceNextStep({
      detail: baseDetail,
      displayStatus: 'Unsent',
      isPaid: false,
      hasBeenSent: false,
      canSend: true,
      accountingState: 'not_connected',
    });

    expect(next?.kind).toBe('send_invoice');
  });
});

describe('send and sidebar labels', () => {
  it('uses Send invoice when never sent', () => {
    expect(deriveSendInvoiceCtaLabel(false)).toBe('Send invoice');
    expect(deriveSidebarInvoiceLabel(false)).toBe('Not sent');
  });

  it('uses Resend invoice after successful send', () => {
    expect(deriveSendInvoiceCtaLabel(true)).toBe('Resend invoice');
    expect(deriveSidebarInvoiceLabel(true)).toBe('Sent');
  });
});

describe('payment lifecycle presentation', () => {
  it('maps unpaid invoices to Awaiting payment instead of Processing', () => {
    expect(
      deriveMerchantPaymentLifecycleHealthLabel({
        payStatus: 'Unpaid',
        isPaid: false,
        apiHealthLabel: 'Processing',
      })
    ).toBe('Awaiting payment');
  });

  it('hides accounting sync note when accounting is disconnected', () => {
    expect(
      shouldShowPaymentLifecycleAccountingNote({
        accountingState: 'not_connected',
        accountingStageLabel: 'accounting sync started',
      })
    ).toBe(false);
  });

  it('shows accounting sync note when accounting is connected', () => {
    expect(
      shouldShowPaymentLifecycleAccountingNote({
        accountingState: 'sync_pending',
        accountingStageLabel: 'accounting sync started',
      })
    ).toBe(true);
  });

  it('filters accounting timeline items when disconnected', () => {
    const filtered = filterMerchantPaymentLifecycleTimeline(
      [
        { stage: 'ISSUED', label: 'Invoice Created' },
        { stage: 'EXPORTED', label: 'Invoice Exported' },
        { stage: 'ACCOUNTING_SYNC_STARTED', label: 'Accounting Sync Started' },
      ],
      'not_connected'
    );

    expect(filtered.map((item) => item.stage)).toEqual(['ISSUED']);
  });
});

describe('hasInvoiceBeenSent', () => {
  it('returns false without lastSentAt', () => {
    expect(hasInvoiceBeenSent({ status: 'OPEN' })).toBe(false);
  });

  it('returns true when lastSentAt exists', () => {
    expect(
      hasInvoiceBeenSent({
        status: 'OPEN',
        lastSentAt: '2026-08-14T09:00:00.000Z',
      })
    ).toBe(true);
  });
});
