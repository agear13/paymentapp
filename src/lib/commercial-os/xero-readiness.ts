/**
 * Single source of truth for Commercial OS Xero setup readiness (frontend only).
 * Consumes existing API payloads — no backend logic.
 */

import {
  allInvoiceAccountsConfigured,
  buildMappingFieldStates,
  computeHeroSubline,
  countInvoiceAccountActions,
  countOptionalRecommended,
  countSettlementAccountActions,
  filterPostConnectSyncs,
  invoiceAccountsNeedAction,
  settlementAccountsNeedAction,
  settlementAccountsReady,
  shouldShowPastPayments,
  type HeroAnswer,
  type MappingDisplayState,
  type XeroRecentSync,
} from '@/lib/commercial-os/xero-invoice-readiness';
import type { XeroMappingField } from '@/lib/accounting/recommended-accounting-config';
import type { MerchantPaymentRails } from '@/lib/xero/xero-setup-guidance';

export type XeroOverallStatus = 'setup_incomplete' | 'ready_to_invoice' | 'fully_set_up';

export type XeroReadinessConnection = {
  connected: boolean;
  tenantSelected: boolean;
  connectedAt?: string | null;
  operatorMessage?: string | null;
};

export type XeroReadinessMappingField = 'revenue' | 'receivable' | 'stripeClearing' | 'processorFees';

export type XeroReadinessFieldState = {
  saved: boolean;
  validInChart: boolean;
  code?: string | null;
};

export type XeroReadinessInvoiceMappings = {
  revenue: XeroReadinessFieldState;
  receivable: XeroReadinessFieldState;
};

export type XeroReadinessPaymentMappings = {
  stripeClearing: XeroReadinessFieldState;
  processorFees: XeroReadinessFieldState;
};

export type XeroReadinessQueue = {
  pendingCount: number;
  hasRecentFailures: boolean;
  showPastPayments: boolean;
  postConnectSyncs: XeroRecentSync[];
};

export type XeroReadinessNextAction = {
  label: string;
  href?: string;
  sectionId?: string;
};

export type XeroReadinessResult = {
  loading: boolean;
  connection: XeroReadinessConnection;
  invoiceMappings: XeroReadinessInvoiceMappings;
  paymentMappings: XeroReadinessPaymentMappings;
  queue: XeroReadinessQueue;
  overallStatus: XeroOverallStatus;
  statusLabel: string;
  statusDetail: string;
  blockers: string[];
  recommendations: string[];
  nextAction: XeroReadinessNextAction | null;
  canCreateInvoice: boolean;
  heroAnswer: HeroAnswer;
  heroSubline: string;
  fieldStates: Partial<Record<XeroMappingField, MappingDisplayState>>;
  invoiceAccountsNeedAction: boolean;
  invoiceAccountActionCount: number;
  allInvoiceAccountsConfigured: boolean;
  settlementAccountsNeedAction: boolean;
  settlementAccountActionCount: number;
  optionalRecommendedCount: number;
};

export type XeroReadinessMappingsPayload = {
  xero_revenue_account_id?: string | null;
  xero_receivable_account_id?: string | null;
  xero_stripe_clearing_account_id?: string | null;
  xero_fee_expense_account_id?: string | null;
  xero_hbar_clearing_account_id?: string | null;
  xero_usdc_clearing_account_id?: string | null;
  xero_usdt_clearing_account_id?: string | null;
  xero_audd_clearing_account_id?: string | null;
  xero_wise_clearing_account_id?: string | null;
};

export type XeroReadinessInput = {
  status: {
    connected?: boolean;
    tenantId?: string | null;
    connectedAt?: string | Date | null;
    operatorMessage?: string | null;
  };
  mappings: XeroReadinessMappingsPayload | null;
  chartAccountCodes: Set<string> | null;
  chartLoaded: boolean;
  queue: {
    pendingCount: number;
    hasRecentFailures: boolean;
    recentSyncs?: XeroRecentSync[];
  };
  merchantRails: MerchantPaymentRails;
};

const STATUS_LABELS: Record<XeroOverallStatus, string> = {
  setup_incomplete: 'Setup incomplete',
  ready_to_invoice: 'Ready to invoice',
  fully_set_up: 'All set',
};

function fieldState(
  code: string | null | undefined,
  chartAccountCodes: Set<string> | null,
  chartLoaded: boolean
): XeroReadinessFieldState {
  const trimmed = code?.trim();
  if (!trimmed) {
    return { saved: false, validInChart: false, code: null };
  }
  if (!chartLoaded || !chartAccountCodes) {
    return { saved: true, validInChart: true, code: trimmed };
  }
  return {
    saved: true,
    validInChart: chartAccountCodes.has(trimmed),
    code: trimmed,
  };
}

function normalizeConnectedAt(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function computeXeroReadiness(input: XeroReadinessInput): Omit<XeroReadinessResult, 'loading'> {
  const connected = Boolean(input.status.connected);
  const tenantSelected = connected && Boolean(input.status.tenantId?.trim());
  const connectedAt = normalizeConnectedAt(input.status.connectedAt ?? null);

  const connection: XeroReadinessConnection = {
    connected,
    tenantSelected,
    connectedAt,
    operatorMessage: input.status.operatorMessage,
  };

  const invoiceMappings: XeroReadinessInvoiceMappings = {
    revenue: fieldState(
      input.mappings?.xero_revenue_account_id,
      input.chartAccountCodes,
      input.chartLoaded
    ),
    receivable: fieldState(
      input.mappings?.xero_receivable_account_id,
      input.chartAccountCodes,
      input.chartLoaded
    ),
  };

  const paymentMappings: XeroReadinessPaymentMappings = {
    stripeClearing: fieldState(
      input.mappings?.xero_stripe_clearing_account_id,
      input.chartAccountCodes,
      input.chartLoaded
    ),
    processorFees: fieldState(
      input.mappings?.xero_fee_expense_account_id,
      input.chartAccountCodes,
      input.chartLoaded
    ),
  };

  const recentSyncs = input.queue.recentSyncs ?? [];
  const postConnectSyncs = filterPostConnectSyncs(recentSyncs, connectedAt);

  const queue: XeroReadinessQueue = {
    pendingCount: input.queue.pendingCount,
    hasRecentFailures: postConnectSyncs.some((sync) => sync.status === 'FAILED'),
    showPastPayments: shouldShowPastPayments(recentSyncs, connectedAt),
    postConnectSyncs,
  };

  const blockers: string[] = [];
  const recommendations: string[] = [];

  const coreInvoiceAccountsReady =
    connected &&
    tenantSelected &&
    invoiceMappings.revenue.saved &&
    invoiceMappings.revenue.validInChart &&
    invoiceMappings.receivable.saved &&
    invoiceMappings.receivable.validInChart;

  const settlementReady = settlementAccountsReady(input.mappings, input.merchantRails);

  const coreInvoiceReady = coreInvoiceAccountsReady && settlementReady;

  const fieldStates = buildMappingFieldStates(
    input.mappings,
    input.chartLoaded,
    input.chartAccountCodes,
    input.merchantRails
  );

  let overallStatus: XeroOverallStatus = 'setup_incomplete';

  if (coreInvoiceReady) {
    overallStatus = 'ready_to_invoice';
    const stripeReady =
      !input.merchantRails.stripeEnabled ||
      (paymentMappings.stripeClearing.saved && paymentMappings.stripeClearing.validInChart);
    if (stripeReady) {
      overallStatus = 'fully_set_up';
    }
  }

  const canCreateInvoice = coreInvoiceReady;
  const heroAnswer: HeroAnswer = canCreateInvoice ? 'Yes' : 'Not yet';
  const heroSubline = computeHeroSubline({
    connected,
    tenantSelected,
    canSendInvoices: canCreateInvoice,
    settlementReady,
    fieldStates,
  });

  const statusDetail = heroSubline;

  let nextAction: XeroReadinessNextAction | null = null;
  if (!connected) {
    nextAction = { label: 'Connect Xero', sectionId: 'xero-connection' };
  } else if (!tenantSelected) {
    nextAction = { label: 'Choose Xero business', sectionId: 'xero-connection' };
  } else if (!canCreateInvoice) {
    nextAction = {
      label: 'Complete Xero setup',
      sectionId: 'invoice-accounts',
    };
  } else if (overallStatus === 'ready_to_invoice') {
    nextAction = {
      label: 'Create your first invoice',
      href: '/workspace/receivables/create',
    };
  }

  return {
    connection,
    invoiceMappings,
    paymentMappings,
    queue,
    overallStatus,
    statusLabel: STATUS_LABELS[overallStatus],
    statusDetail,
    blockers,
    recommendations,
    nextAction,
    canCreateInvoice,
    heroAnswer,
    heroSubline,
    fieldStates,
    invoiceAccountsNeedAction: invoiceAccountsNeedAction(fieldStates),
    invoiceAccountActionCount: countInvoiceAccountActions(fieldStates),
    allInvoiceAccountsConfigured: allInvoiceAccountsConfigured(fieldStates),
    settlementAccountsNeedAction: settlementAccountsNeedAction(
      fieldStates,
      input.merchantRails
    ),
    settlementAccountActionCount: countSettlementAccountActions(
      fieldStates,
      input.merchantRails
    ),
    optionalRecommendedCount: countOptionalRecommended(fieldStates, input.merchantRails),
  };
}

export const EMPTY_XERO_READINESS: Omit<XeroReadinessResult, 'loading'> = {
  connection: { connected: false, tenantSelected: false },
  invoiceMappings: {
    revenue: { saved: false, validInChart: false },
    receivable: { saved: false, validInChart: false },
  },
  paymentMappings: {
    stripeClearing: { saved: false, validInChart: false },
    processorFees: { saved: false, validInChart: false },
  },
  queue: {
    pendingCount: 0,
    hasRecentFailures: false,
    showPastPayments: false,
    postConnectSyncs: [],
  },
  overallStatus: 'setup_incomplete',
  statusLabel: STATUS_LABELS.setup_incomplete,
  statusDetail: 'Connect Xero first — use the section below.',
  blockers: [],
  recommendations: [],
  nextAction: { label: 'Connect Xero', sectionId: 'xero-connection' },
  canCreateInvoice: false,
  heroAnswer: 'Not yet',
  heroSubline: 'Connect Xero first — use the section below.',
  fieldStates: {},
  invoiceAccountsNeedAction: true,
  invoiceAccountActionCount: 2,
  allInvoiceAccountsConfigured: false,
  settlementAccountsNeedAction: false,
  settlementAccountActionCount: 0,
  optionalRecommendedCount: 0,
};
