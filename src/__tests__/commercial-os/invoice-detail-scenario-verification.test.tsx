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
  type InvoiceDetailViewModel,
} from '@/lib/payment-links/invoice-detail-view-model';
import { receivablesInvoiceXeroColumn } from '@/lib/xero/xero-sync-display';
import type { LifecycleSnapshot } from '@/lib/payment-links/payment-link-merchant-actions';

const BASE_CREATED = '2026-08-13T10:00:00.000Z';
const BASE_SENT = '2026-08-14T09:00:00.000Z';
const BASE_PAID = '2026-08-15T12:00:00.000Z';

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
    dueDate: new Date('2026-08-31T00:00:00Z'),
    expiresAt: new Date('2026-09-30T00:00:00Z'),
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
    sidebarSent: vm.hasBeenSent ? 'Yes' : 'No',
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
  it('1. new unsent invoice + accounting disconnected', () => {
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

    expectSurfaces('1 unsent + disconnected', s, {
      headerBadge: 'Unsent',
      heroHeadline: 'Ready to send',
      heroPaymentStatus: 'Unpaid',
      sidebarPayment: 'Unpaid',
      heroAccountingStatus: 'Accounting not connected',
      sidebarAccounting: 'Accounting not connected',
      sidebarSettlement: 'Awaiting payment',
      sidebarSent: 'No',
      nextStepTitle: 'Next step',
      nextStepKind: 'send_invoice',
      showAccountingSyncDetails: false,
      timelineIncludes: ['Invoice Created', 'Payment link ready'],
      forbidden: ['Sync in progress', 'PENDING', 'Last synced'],
    });
  });

  it('2. send invoice successfully', () => {
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

    expectSurfaces('2 sent after email', s, {
      headerBadge: 'Sent',
      heroHeadline: 'Awaiting payment',
      heroPaymentStatus: 'Unpaid',
      sidebarPayment: 'Unpaid',
      heroAccountingStatus: 'Accounting not connected',
      sidebarAccounting: 'Accounting not connected',
      sidebarSettlement: 'Awaiting payment',
      sidebarSent: 'Yes',
      nextStepTitle: 'Optional',
      nextStepKind: 'accounting_connect',
      forbidden: ['Sync in progress', 'Send this invoice'],
    });
  });

  it('3. sent + unpaid', () => {
    const detail = baseDetail({
      lastSentAt: new Date(BASE_SENT),
      lastSentToEmail: 'client@example.com',
    });

    const vm = deriveInvoiceDetailViewModel({
      detail,
      lifecycle: OUTSTANDING_LIFECYCLE,
      accountingConnection: CONNECTED_READY,
    });
    const s = deriveUiSurfaces(vm, detail);

    expectSurfaces('3 sent + unpaid + connected', s, {
      headerBadge: 'Sent',
      heroHeadline: 'Awaiting payment',
      heroPaymentStatus: 'Unpaid',
      sidebarPayment: 'Unpaid',
      heroAccountingStatus: 'Not synced',
      sidebarAccounting: 'Not synced',
      sidebarSettlement: 'Awaiting payment',
      sidebarSent: 'Yes',
      nextStepTitle: null,
      nextStepKind: null,
      showAccountingSyncDetails: true,
      forbidden: ['Send this invoice', 'Accounting not connected'],
    });
  });

  it('4. paid invoice', () => {
    const detail = baseDetail({
      status: 'PAID',
      paidAt: new Date(BASE_PAID),
      lastSentAt: new Date(BASE_SENT),
      lastSentToEmail: 'client@example.com',
      paymentEvents: [
        {
          id: 'ev-confirmed',
          eventType: 'PAYMENT_CONFIRMED',
          paymentMethod: 'STRIPE',
          createdAt: new Date(BASE_PAID),
        },
      ],
    });

    const vm = deriveInvoiceDetailViewModel({
      detail,
      lifecycle: PAID_LIFECYCLE,
      accountingConnection: CONNECTED_READY,
    });
    const s = deriveUiSurfaces(vm, detail);

    expectSurfaces('4 paid', s, {
      headerBadge: 'Paid',
      heroHeadline: 'Paid',
      heroPaymentStatus: 'Settled',
      sidebarPayment: 'Settled',
      heroAccountingStatus: 'Not synced',
      sidebarAccounting: 'Not synced',
      sidebarSettlement: 'Payment recorded',
      sidebarSent: 'Yes',
      nextStepTitle: 'Next step',
      nextStepKind: 'accounting_action',
      timelineIncludes: ['Invoice Created', 'Invoice Paid', 'Payment confirmed'],
    });
  });

  it('5. accounting connected + sync in progress', () => {
    const detail = baseDetail({
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

    const vm = deriveInvoiceDetailViewModel({
      detail,
      lifecycle: OUTSTANDING_LIFECYCLE,
      accountingConnection: CONNECTED_READY,
    });
    const s = deriveUiSurfaces(vm, detail);

    expectSurfaces('5 sync in progress', s, {
      headerBadge: 'Sent',
      heroHeadline: 'Awaiting payment',
      heroPaymentStatus: 'Unpaid',
      sidebarPayment: 'Unpaid',
      heroAccountingStatus: 'Sync in progress',
      sidebarAccounting: 'Sync in progress',
      sidebarSettlement: 'Awaiting payment',
      sidebarSent: 'Yes',
      nextStepTitle: null,
      nextStepKind: null,
      showAccountingSyncDetails: true,
      accountingGuidanceTitle: 'Sync in progress',
    });
  });

  it('6. accounting connected + sync completed', () => {
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

    expectSurfaces('6 sync completed', s, {
      headerBadge: 'Paid',
      heroHeadline: 'Paid',
      heroPaymentStatus: 'Settled',
      sidebarPayment: 'Settled',
      heroAccountingStatus: 'Synced',
      sidebarAccounting: 'Synced',
      sidebarSettlement: 'Payment recorded',
      sidebarSent: 'Yes',
      nextStepTitle: 'Payment received',
      nextStepKind: 'payment_received',
      showAccountingSyncDetails: true,
      accountingGuidanceTitle: 'Synced with accounting',
    });
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
    expect(readSidebar('Sent')).toBe(vm.hasBeenSent ? 'Yes' : 'No');
    expect(readSidebar('Accounting')).toBe(vm.accountingStatusLabel);
    expect(readSidebar('Settlement')).toBe(vm.settlementSummaryLabel);

    if (vm.nextStep) {
      expect(screen.getByText(vm.nextStep.title)).toBeInTheDocument();
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
});
