/** @jest-environment jsdom */

/**
 * Final verification harness for invoice detail UX/state consistency.
 * Exercises six merchant scenarios against view-model derivation and rendered surfaces.
 */

import '@testing-library/jest-dom';
import { render, screen, cleanup, within } from '@testing-library/react';
import type { PaymentLinkDetails } from '@/components/payment-links/payment-link-detail-dialog';
import {
  deriveInvoiceDetailViewModel,
  deriveMerchantPaymentLifecycleHealthLabel,
  filterMerchantPaymentLifecycleTimeline,
  shouldShowPaymentLifecycleAccountingNote,
  type InvoiceDetailViewModel,
} from '@/lib/payment-links/invoice-detail-view-model';
import { receivablesInvoiceXeroColumn } from '@/lib/xero/xero-sync-display';
import type { LifecycleSnapshot } from '@/lib/payment-links/payment-link-merchant-actions';

const BASE_CREATED = '2026-08-13T10:00:00.000Z';
const BASE_SENT = '2026-08-14T09:00:00.000Z';
const BASE_PAID = '2026-08-15T12:00:00.000Z';
const MS_DAY = 24 * 60 * 60 * 1000;
const futureDueDate = () => new Date(Date.now() + 14 * MS_DAY);
const pastDueDate = () => new Date(Date.now() - 14 * MS_DAY);
const futureExpiry = () => new Date(Date.now() + 45 * MS_DAY);

const NOT_CONNECTED = { connected: false, syncReady: false };
const CONNECTED_READY = { connected: true, syncReady: true };

function baseDetail(overrides: Partial<PaymentLinkDetails> = {}): PaymentLinkDetails {
  return {
    id: 'plink-verify',
    shortCode: 'Ab12Cd34',
    status: 'OPEN',
    amount: 1500,
    currency: 'AUD',
    description: 'Verification invoice',
    invoiceReference: 'INV-VERIFY-001',
    customerEmail: 'client@example.com',
    customerName: 'Verify Co',
    customerPhone: null,
    invoiceDate: new Date('2026-08-01T00:00:00Z'),
    dueDate: futureDueDate(),
    expiresAt: futureExpiry(),
    paymentMethod: 'STRIPE',
    createdAt: new Date(BASE_CREATED),
    updatedAt: new Date(BASE_CREATED),
    ...overrides,
  };
}

const OUTSTANDING_LIFECYCLE: LifecycleSnapshot = {
  invoiceLifecycle: {
    state: 'OUTSTANDING',
    stateLabel: 'Awaiting Payment',
    amountPaid: 0,
    amountOutstanding: 1500,
    timeline: [
      {
        id: 'created',
        state: 'ISSUED',
        label: 'Invoice Created',
        reached: true,
        occurredAt: BASE_CREATED,
      },
    ],
  },
};

const PAID_LIFECYCLE: LifecycleSnapshot = {
  invoiceLifecycle: {
    state: 'PAID',
    stateLabel: 'Invoice Paid',
    amountPaid: 1500,
    amountOutstanding: 0,
    timeline: [
      {
        id: 'created',
        state: 'ISSUED',
        label: 'Invoice Created',
        reached: true,
        occurredAt: BASE_CREATED,
      },
      {
        id: 'paid',
        state: 'PAID',
        label: 'Invoice Paid',
        reached: true,
        occurredAt: BASE_PAID,
      },
    ],
  },
};

function deriveUiSurfaces(
  vm: InvoiceDetailViewModel,
  detail: PaymentLinkDetails
) {
  const xeroDisplay =
    vm.showAccountingSyncDetails ? receivablesInvoiceXeroColumn(detail.xeroSyncs) : null;

  return {
    headerBadge: vm.displayStatus,
    heroHeadline: vm.hero.headline,
    heroPaymentStatus: vm.payStatus,
    heroAccountingStatus:
      xeroDisplay?.label ??
      (vm.accountingState === 'not_connected' || vm.showAccountingSyncDetails
        ? vm.accountingStatusLabel
        : null),
    nextStepTitle: vm.nextStep?.title ?? null,
    nextStepKind: vm.nextStep?.kind ?? null,
    sidebarPayment: vm.payStatus,
    sidebarSent: vm.sidebarInvoiceLabel,
    sendInvoiceCtaLabel: vm.sendInvoiceCtaLabel,
    paymentLifecycleHealth: deriveMerchantPaymentLifecycleHealthLabel({
      payStatus: vm.payStatus,
      isPaid: vm.isPaid,
      apiHealthLabel: 'Processing',
    }),
    showAccountingLifecycleNote: shouldShowPaymentLifecycleAccountingNote({
      accountingState: vm.accountingState,
      accountingStageLabel: 'accounting sync started',
    }),
    sidebarAccounting: vm.accountingStatusLabel,
    sidebarSettlement: vm.settlementSummaryLabel,
    timelineLabels: vm.timeline.map((e) => e.label),
    showAccountingSyncDetails: vm.showAccountingSyncDetails,
    accountingGuidanceTitle: vm.accountingGuidance.title,
  };
}

function expectSurfaces(
  scenario: string,
  surfaces: ReturnType<typeof deriveUiSurfaces>,
  expected: Partial<ReturnType<typeof deriveUiSurfaces>> & {
    timelineIncludes?: string[];
    forbidden?: string[];
  }
) {
  const discrepancies: string[] = [];

  for (const [key, value] of Object.entries(expected)) {
    if (key === 'timelineIncludes' || key === 'forbidden') continue;
    const actual = surfaces[key as keyof typeof surfaces];
    if (actual !== value) {
      discrepancies.push(`${key}: expected "${value}", got "${actual}"`);
    }
  }

  for (const label of expected.timelineIncludes ?? []) {
    if (!surfaces.timelineLabels.includes(label)) {
      discrepancies.push(
        `timeline missing "${label}" (has: ${surfaces.timelineLabels.join(', ')})`
      );
    }
  }

  const serialized = JSON.stringify(surfaces);
  for (const text of expected.forbidden ?? []) {
    if (serialized.includes(text)) {
      discrepancies.push(`forbidden "${text}" found in surfaces`);
    }
  }

  if (discrepancies.length > 0) {
    throw new Error(`[${scenario}]\n- ${discrepancies.join('\n- ')}`);
  }
}

describe('invoice detail scenario verification (view-model + UI surfaces)', () => {
  it('A: unsent + accounting disconnected', () => {
    const detail = baseDetail({
      paymentEvents: [
        { id: 'ev-created', eventType: 'CREATED', createdAt: new Date(BASE_CREATED) },
        {
          id: 'ev-init',
          eventType: 'PAYMENT_INITIATED',
          paymentMethod: 'STRIPE',
          createdAt: new Date('2026-08-13T10:00:01.000Z'),
        },
      ],
    });

    const vm = deriveInvoiceDetailViewModel({
      detail,
      lifecycle: OUTSTANDING_LIFECYCLE,
      accountingConnection: NOT_CONNECTED,
    });
    const s = deriveUiSurfaces(vm, detail);

    expectSurfaces('A unsent + disconnected', s, {
      headerBadge: 'Unsent',
      heroHeadline: 'Ready to send',
      heroPaymentStatus: 'Unpaid',
      sidebarPayment: 'Unpaid',
      heroAccountingStatus: 'Accounting not connected',
      sidebarAccounting: 'Accounting not connected',
      sidebarSettlement: 'Awaiting payment',
      sidebarSent: 'Not sent',
      sendInvoiceCtaLabel: 'Send invoice',
      nextStepTitle: 'Next step',
      nextStepKind: 'send_invoice',
      showAccountingSyncDetails: false,
      paymentLifecycleHealth: 'Awaiting payment',
      showAccountingLifecycleNote: false,
      timelineIncludes: ['Invoice created', 'Payment link ready'],
      forbidden: ['Sync in progress', 'PENDING', 'Last synced', 'accounting sync'],
    });
  });

  it('B: sent + accounting disconnected', () => {
    const detail = baseDetail({
      lastSentAt: new Date(BASE_SENT),
      lastSentToEmail: 'client@example.com',
    });

    const vm = deriveInvoiceDetailViewModel({
      detail,
      lifecycle: OUTSTANDING_LIFECYCLE,
      accountingConnection: NOT_CONNECTED,
    });
    const s = deriveUiSurfaces(vm, detail);

    expectSurfaces('B sent + disconnected', s, {
      headerBadge: 'Sent',
      heroHeadline: 'Awaiting payment',
      heroPaymentStatus: 'Unpaid',
      sidebarPayment: 'Unpaid',
      heroAccountingStatus: 'Accounting not connected',
      sidebarAccounting: 'Accounting not connected',
      sidebarSettlement: 'Awaiting payment',
      sidebarSent: 'Sent',
      sendInvoiceCtaLabel: 'Resend invoice',
      nextStepTitle: 'Optional',
      nextStepKind: 'accounting_connect',
      paymentLifecycleHealth: 'Awaiting payment',
      showAccountingLifecycleNote: false,
      timelineIncludes: ['Invoice sent'],
      forbidden: ['Sync in progress', 'Send this invoice', 'accounting sync'],
    });
  });

  it('C: sent + accounting connected + sync in progress', () => {
    const detail = baseDetail({
      lastSentAt: new Date(BASE_SENT),
      lastSentToEmail: 'client@example.com',
      xeroSyncs: [
        {
          id: 'sync-1',
          syncType: 'INVOICE',
          status: 'PENDING',
          createdAt: new Date(BASE_SENT),
          updatedAt: new Date(BASE_SENT),
        },
      ],
    });

    const vm = deriveInvoiceDetailViewModel({
      detail,
      lifecycle: OUTSTANDING_LIFECYCLE,
      accountingConnection: CONNECTED_READY,
    });
    const s = deriveUiSurfaces(vm, detail);

    expectSurfaces('C sent + sync in progress', s, {
      headerBadge: 'Sent',
      heroHeadline: 'Awaiting payment',
      heroPaymentStatus: 'Unpaid',
      sidebarPayment: 'Unpaid',
      heroAccountingStatus: 'Sync in progress',
      sidebarAccounting: 'Sync in progress',
      sidebarSettlement: 'Awaiting payment',
      sidebarSent: 'Sent',
      sendInvoiceCtaLabel: 'Resend invoice',
      nextStepTitle: null,
      nextStepKind: null,
      showAccountingSyncDetails: true,
      accountingGuidanceTitle: 'Sync in progress',
      paymentLifecycleHealth: 'Awaiting payment',
      showAccountingLifecycleNote: true,
      forbidden: ['Accounting not connected'],
    });
  });

  it('D: sent + accounting connected + sync completed (unpaid)', () => {
    const detail = baseDetail({
      lastSentAt: new Date(BASE_SENT),
      lastSentToEmail: 'client@example.com',
      xeroSyncs: [
        {
          id: 'sync-1',
          syncType: 'INVOICE',
          status: 'SUCCESS',
          xeroInvoiceId: 'xero-inv-99',
          createdAt: new Date(BASE_SENT),
          updatedAt: new Date(BASE_SENT),
        },
      ],
    });

    const vm = deriveInvoiceDetailViewModel({
      detail,
      lifecycle: OUTSTANDING_LIFECYCLE,
      accountingConnection: CONNECTED_READY,
    });
    const s = deriveUiSurfaces(vm, detail);

    expectSurfaces('D sent + synced unpaid', s, {
      headerBadge: 'Sent',
      heroHeadline: 'Awaiting payment',
      heroPaymentStatus: 'Unpaid',
      sidebarPayment: 'Unpaid',
      heroAccountingStatus: 'Synced',
      sidebarAccounting: 'Synced',
      sidebarSettlement: 'Awaiting payment',
      sidebarSent: 'Sent',
      paymentLifecycleHealth: 'Awaiting payment',
      showAccountingSyncDetails: true,
    });
  });

  it('E: paid + accounting disconnected', () => {
    const detail = baseDetail({
      status: 'PAID',
      paidAt: new Date(BASE_PAID),
      lastSentAt: new Date(BASE_SENT),
      lastSentToEmail: 'client@example.com',
    });

    const vm = deriveInvoiceDetailViewModel({
      detail,
      lifecycle: PAID_LIFECYCLE,
      accountingConnection: NOT_CONNECTED,
    });
    const s = deriveUiSurfaces(vm, detail);

    expectSurfaces('E paid + disconnected', s, {
      headerBadge: 'Paid',
      heroHeadline: 'Paid',
      heroPaymentStatus: 'Settled',
      sidebarPayment: 'Settled',
      heroAccountingStatus: 'Accounting not connected',
      sidebarAccounting: 'Accounting not connected',
      sidebarSettlement: 'Payment received',
      sidebarSent: 'Sent',
      nextStepTitle: 'Next step',
      nextStepKind: 'accounting_connect',
      showAccountingSyncDetails: false,
      showAccountingLifecycleNote: false,
      forbidden: ['accounting sync'],
    });
  });

  it('F: paid + accounting connected', () => {
    const detail = baseDetail({
      status: 'PAID',
      paidAt: new Date(BASE_PAID),
      lastSentAt: new Date(BASE_SENT),
      lastSentToEmail: 'client@example.com',
      xeroInvoiceNumber: 'INV-XERO-99',
      xeroSyncs: [
        {
          id: 'sync-1',
          syncType: 'INVOICE',
          status: 'SUCCESS',
          xeroInvoiceId: 'xero-inv-99',
          createdAt: new Date(BASE_SENT),
          updatedAt: new Date(BASE_SENT),
        },
        {
          id: 'sync-2',
          syncType: 'PAYMENT',
          status: 'SUCCESS',
          xeroPaymentId: 'xero-pay-99',
          createdAt: new Date(BASE_PAID),
          updatedAt: new Date(BASE_PAID),
        },
      ],
    });

    const vm = deriveInvoiceDetailViewModel({
      detail,
      lifecycle: PAID_LIFECYCLE,
      accountingConnection: CONNECTED_READY,
    });
    const s = deriveUiSurfaces(vm, detail);

    expectSurfaces('F paid + connected synced', s, {
      headerBadge: 'Paid',
      heroHeadline: 'Paid',
      heroPaymentStatus: 'Settled',
      sidebarPayment: 'Settled',
      heroAccountingStatus: 'Synced',
      sidebarAccounting: 'Synced',
      sidebarSettlement: 'Payment received',
      sidebarSent: 'Sent',
      nextStepTitle: 'Payment received',
      nextStepKind: 'payment_received',
      showAccountingSyncDetails: true,
      accountingGuidanceTitle: 'Synced with accounting',
    });
  });

  it('G: unpaid past due is Overdue even after send', () => {
    const detail = baseDetail({
      dueDate: pastDueDate(),
      lastSentAt: new Date(BASE_SENT),
      lastSentToEmail: 'client@example.com',
    });

    const vm = deriveInvoiceDetailViewModel({
      detail,
      lifecycle: OUTSTANDING_LIFECYCLE,
      accountingConnection: NOT_CONNECTED,
    });
    const s = deriveUiSurfaces(vm, detail);

    expectSurfaces('G sent + past due', s, {
      headerBadge: 'Overdue',
      heroHeadline: 'Overdue',
      heroPaymentStatus: 'Unpaid',
      sidebarPayment: 'Unpaid',
      sidebarSent: 'Sent',
      sendInvoiceCtaLabel: 'Resend invoice',
    });
  });

  it('deduplicates duplicate invoice created events in commercial activity', () => {
    const detail = baseDetail({
      lastSentAt: new Date('2026-08-13T13:55:00.000Z'),
      lastSentToEmail: 'client@example.com',
      paymentEvents: [
        {
          id: 'ev-init',
          eventType: 'PAYMENT_INITIATED',
          paymentMethod: 'STRIPE',
          createdAt: new Date('2026-08-13T13:54:00.000Z'),
        },
        {
          id: 'ev-created-late',
          eventType: 'CREATED',
          createdAt: new Date('2026-08-13T13:55:00.000Z'),
        },
      ],
    });

    const vm = deriveInvoiceDetailViewModel({
      detail,
      lifecycle: {
        invoiceLifecycle: {
          state: 'OUTSTANDING',
          stateLabel: 'Awaiting Payment',
          amountPaid: 0,
          amountOutstanding: 1500,
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
      },
      accountingConnection: NOT_CONNECTED,
    });

    const createdCount = vm.timeline.filter((e) => e.label === 'Invoice created').length;
    expect(createdCount).toBe(1);
    expect(vm.timeline.map((e) => e.label)).toEqual([
      'Invoice created',
      'Payment link ready',
      'Invoice sent',
    ]);
  });

  it('filters accounting stages from payment lifecycle timeline when disconnected', () => {
    const filtered = filterMerchantPaymentLifecycleTimeline(
      [
        { stage: 'ISSUED', label: 'Invoice Created' },
        { stage: 'OUTSTANDING', label: 'Awaiting Payment' },
        { stage: 'EXPORTED', label: 'Invoice Exported' },
      ],
      'not_connected'
    );

    expect(filtered.map((item) => item.label)).toEqual([
      'Invoice Created',
      'Awaiting Payment',
    ]);
  });
});

describe('invoice-detail-view-model.ts presentation layer audit', () => {
  it('does not mutate authoritative inputs', () => {
    const detail = baseDetail();
    const lifecycle = JSON.parse(JSON.stringify(OUTSTANDING_LIFECYCLE)) as LifecycleSnapshot;
    const detailBefore = JSON.stringify(detail);
    const lifecycleBefore = JSON.stringify(lifecycle);

    deriveInvoiceDetailViewModel({
      detail,
      lifecycle,
      accountingConnection: NOT_CONNECTED,
    });

    expect(JSON.stringify(detail)).toBe(detailBefore);
    expect(JSON.stringify(lifecycle)).toBe(lifecycleBefore);
  });

  it('derives display fields from existing authoritative helpers without redefining status enums', () => {
    const detail = baseDetail({ status: 'PAID', paidAt: new Date(BASE_PAID) });
    const vm = deriveInvoiceDetailViewModel({
      detail,
      lifecycle: PAID_LIFECYCLE,
      accountingConnection: CONNECTED_READY,
    });

    expect(vm.displayStatus).toBe('Paid');
    expect(vm.payStatus).toBe('Settled');
    expect(vm.accountingState).toBe('not_synced');
  });

  it('masks stale sync rows when accounting is disconnected', () => {
    const vm = deriveInvoiceDetailViewModel({
      detail: baseDetail({
        xeroSyncs: [{ syncType: 'INVOICE', status: 'PENDING' }],
      }),
      lifecycle: OUTSTANDING_LIFECYCLE,
      accountingConnection: NOT_CONNECTED,
    });

    expect(vm.accountingState).toBe('not_connected');
    expect(vm.showAccountingSyncDetails).toBe(false);
  });
});

let mockDetail: PaymentLinkDetails = baseDetail();
let mockLifecycle: LifecycleSnapshot | null = OUTSTANDING_LIFECYCLE;
let mockReadiness = NOT_CONNECTED;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/hooks/use-organization', () => ({
  useOrganization: () => ({ organizationId: 'org-001', isLoading: false }),
}));

jest.mock('@/hooks/use-commercial-readiness', () => ({
  useCommercialReadinessOptional: () => ({
    connection: { connected: mockReadiness.connected },
    canSyncToAccounting: mockReadiness.syncReady,
    canCreateInvoice: mockReadiness.syncReady,
    loading: false,
  }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/components/operational/customer-facing-origin-provider', () => ({
  usePaymentLinkUrl: () => 'https://app.example.com/pay/Ab12Cd34',
}));

jest.mock('@/hooks/use-payment-link-detail', () => ({
  usePaymentLinkDetail: () => ({
    state: {
      status: 'ready',
      paymentLinkId: mockDetail.id,
      detail: mockDetail,
      lifecycle: mockLifecycle,
      qrCodeUrl: null,
      cryptoConfirmation: null,
      manualBankConfirmation: null,
    },
    refresh: jest.fn(),
  }),
}));

jest.mock('@/components/payment-links/payment-links-lazy-modules', () => ({
  CreatePaymentLinkDialog: () => null,
}));

jest.mock('@/components/payment-links/payment-lifecycle-panel', () => ({
  PaymentLifecyclePanel: () => null,
}));

jest.mock('@/components/journey/lovable/invoice-treasury-lifecycle-panel', () => ({
  InvoiceTreasuryLifecyclePanel: () => null,
}));

function readSidebar(label: string): string | null {
  const heading = screen.getByRole('heading', { name: 'At a glance' });
  const section = heading.closest('section');
  if (!section) return null;
  const dt = within(section).getByText(label);
  const row = dt.closest('div');
  return row?.querySelector('dd')?.textContent?.trim() ?? null;
}

describe('invoice detail scenario verification (rendered DOM)', () => {
  afterEach(() => cleanup());

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { WorkspaceInvoiceDetailScreen } = require('@/components/journey/lovable/workspace-invoice-detail-screen');

  function renderAndExpect(scenario: string) {
    const vm = deriveInvoiceDetailViewModel({
      detail: mockDetail,
      lifecycle: mockLifecycle,
      accountingConnection: mockReadiness,
    });

    render(
      <WorkspaceInvoiceDetailScreen
        invoiceNumber={mockDetail.invoiceReference ?? 'INV'}
        paymentLinkId={mockDetail.id}
      />
    );

    expect(screen.getByRole('heading', { name: mockDetail.customerName! })).toBeInTheDocument();
    const headerBadge = document.querySelector('header span.rounded-full');
    expect(headerBadge?.textContent).toBe(vm.displayStatus);
    expect(screen.getAllByText(vm.hero.headline).length).toBeGreaterThan(0);
    expect(readSidebar('Payment')).toBe(vm.payStatus);
    expect(readSidebar('Invoice')).toBe(vm.sidebarInvoiceLabel);
    expect(readSidebar('Accounting')).toBe(vm.accountingStatusLabel);
    expect(readSidebar('Settlement')).toBe(vm.settlementSummaryLabel);

    if (vm.nextStep) {
      expect(screen.getAllByText(vm.nextStep.title).length).toBeGreaterThan(0);
      expect(screen.getByText(vm.nextStep.message)).toBeInTheDocument();
    }

    for (const entry of vm.timeline) {
      expect(screen.getAllByText(entry.label).length).toBeGreaterThan(0);
    }

    return { vm, scenario };
  }

  it('DOM matches view-model for scenario 1', () => {
    mockDetail = baseDetail();
    mockLifecycle = OUTSTANDING_LIFECYCLE;
    mockReadiness = NOT_CONNECTED;
    const { vm } = renderAndExpect('1');
    expect(vm.displayStatus).toBe('Unsent');
    expect(screen.queryByText('Sync in progress')).not.toBeInTheDocument();
  });

  it('DOM matches view-model for scenario 2', () => {
    mockDetail = baseDetail({
      lastSentAt: new Date(BASE_SENT),
      lastSentToEmail: 'client@example.com',
    });
    mockLifecycle = OUTSTANDING_LIFECYCLE;
    mockReadiness = NOT_CONNECTED;
    const { vm } = renderAndExpect('2');
    expect(vm.displayStatus).toBe('Sent');
    expect(screen.getByText('Last sent')).toBeInTheDocument();
  });

  it('DOM matches view-model for scenario 3', () => {
    mockDetail = baseDetail({
      lastSentAt: new Date(BASE_SENT),
      lastSentToEmail: 'client@example.com',
    });
    mockLifecycle = OUTSTANDING_LIFECYCLE;
    mockReadiness = CONNECTED_READY;
    const { vm } = renderAndExpect('3');
    expect(readSidebar('Accounting')).toBe(vm.accountingStatusLabel);
    expect(vm.accountingStatusLabel).toBe('Not synced');
  });

  it('DOM matches view-model for scenario 4', () => {
    mockDetail = baseDetail({
      status: 'PAID',
      paidAt: new Date(BASE_PAID),
      lastSentAt: new Date(BASE_SENT),
    });
    mockLifecycle = PAID_LIFECYCLE;
    mockReadiness = CONNECTED_READY;
    const { vm } = renderAndExpect('4');
    expect(vm.displayStatus).toBe('Paid');
    expect(readSidebar('Payment')).toBe('Settled');
  });

  it('DOM matches view-model for scenario 5', () => {
    mockDetail = baseDetail({
      lastSentAt: new Date(BASE_SENT),
      xeroSyncs: [
        {
          id: 'sync-1',
          syncType: 'INVOICE',
          status: 'PENDING',
          createdAt: new Date(BASE_SENT),
          updatedAt: new Date(BASE_SENT),
        },
      ],
    });
    mockLifecycle = OUTSTANDING_LIFECYCLE;
    mockReadiness = CONNECTED_READY;
    const { vm } = renderAndExpect('5');
    expect(vm.accountingState).toBe('sync_pending');
    expect(screen.getAllByText('Sync in progress').length).toBeGreaterThan(0);
  });

  it('DOM matches view-model for scenario 6', () => {
    mockDetail = baseDetail({
      status: 'PAID',
      paidAt: new Date(BASE_PAID),
      lastSentAt: new Date(BASE_SENT),
      xeroSyncs: [
        {
          id: 'sync-1',
          syncType: 'INVOICE',
          status: 'SUCCESS',
          xeroInvoiceId: 'xero-inv-99',
          createdAt: new Date(BASE_SENT),
          updatedAt: new Date(BASE_SENT),
        },
      ],
    });
    mockLifecycle = PAID_LIFECYCLE;
    mockReadiness = CONNECTED_READY;
    const { vm } = renderAndExpect('6');
    expect(vm.accountingState).toBe('synced');
    expect(screen.getAllByText('Synced').length).toBeGreaterThan(0);
  });

  it('DOM matches view-model for overdue unpaid invoice', () => {
    mockDetail = baseDetail({
      dueDate: pastDueDate(),
      lastSentAt: new Date(BASE_SENT),
      lastSentToEmail: 'client@example.com',
    });
    mockLifecycle = OUTSTANDING_LIFECYCLE;
    mockReadiness = NOT_CONNECTED;
    const { vm } = renderAndExpect('overdue');
    expect(vm.displayStatus).toBe('Overdue');
    expect(screen.getAllByText('Overdue').length).toBeGreaterThan(0);
  });
});
