/**
 * Single source of truth for Commercial OS Xero setup readiness (frontend only).
 * Consumes existing API payloads — no backend logic.
 */

import type { MerchantPaymentRails } from '@/lib/xero/xero-setup-guidance';

export type XeroOverallStatus = 'setup_incomplete' | 'ready_to_invoice' | 'fully_set_up';

export type XeroReadinessConnection = {
  connected: boolean;
  tenantSelected: boolean;
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
};

export type XeroReadinessMappingsPayload = {
  xero_revenue_account_id?: string | null;
  xero_receivable_account_id?: string | null;
  xero_stripe_clearing_account_id?: string | null;
  xero_fee_expense_account_id?: string | null;
};

export type XeroReadinessInput = {
  status: {
    connected?: boolean;
    tenantId?: string | null;
    operatorMessage?: string | null;
  };
  mappings: XeroReadinessMappingsPayload | null;
  chartAccountCodes: Set<string> | null;
  chartLoaded: boolean;
  queue: { pendingCount: number; hasRecentFailures: boolean };
  merchantRails: MerchantPaymentRails;
};

const STATUS_LABELS: Record<XeroOverallStatus, string> = {
  setup_incomplete: 'Not ready yet',
  ready_to_invoice: 'Ready to send invoices',
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

function invalidFieldMessage(label: string, state: XeroReadinessFieldState): string | null {
  if (!state.saved) return `Choose a Xero account for ${label}.`;
  if (!state.validInChart) {
    return `The saved ${label} account is no longer in your Xero accounts — pick it again.`;
  }
  return null;
}

export function computeXeroReadiness(input: XeroReadinessInput): Omit<XeroReadinessResult, 'loading'> {
  const connected = Boolean(input.status.connected);
  const tenantSelected = connected && Boolean(input.status.tenantId?.trim());

  const connection: XeroReadinessConnection = {
    connected,
    tenantSelected,
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

  const queue: XeroReadinessQueue = {
    pendingCount: input.queue.pendingCount,
    hasRecentFailures: input.queue.hasRecentFailures,
  };

  const blockers: string[] = [];
  const recommendations: string[] = [];

  if (!connected) {
    blockers.push('Connect Xero to send invoices from Provvy.');
  } else if (!tenantSelected) {
    blockers.push('Select your Xero business.');
  }

  const revenueIssue = invalidFieldMessage('sales from invoices', invoiceMappings.revenue);
  if (revenueIssue) blockers.push(revenueIssue);

  const receivableIssue = invalidFieldMessage('unpaid invoices', invoiceMappings.receivable);
  if (receivableIssue) blockers.push(receivableIssue);

  const coreInvoiceReady =
    connected &&
    tenantSelected &&
    invoiceMappings.revenue.saved &&
    invoiceMappings.revenue.validInChart &&
    invoiceMappings.receivable.saved &&
    invoiceMappings.receivable.validInChart;

  if (input.merchantRails.stripeEnabled) {
    if (!paymentMappings.stripeClearing.saved) {
      recommendations.push(
        'Add a temporary holding account in Xero for card payments — optional, but makes reconciliation easier.'
      );
    } else if (!paymentMappings.stripeClearing.validInChart) {
      recommendations.push(
        'Your saved card-payment holding account is no longer in Xero — choose it again (optional).'
      );
    }
  }

  if (!paymentMappings.processorFees.saved && input.merchantRails.stripeEnabled) {
    recommendations.push('Card processing fees can be set up later if you prefer.');
  }

  // Historical sync counts live on the Past payments section — not duplicated here.

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

  const canCreateInvoice = overallStatus !== 'setup_incomplete';

  let statusDetail: string;
  if (overallStatus === 'setup_incomplete') {
    statusDetail =
      blockers[0] ?? 'Finish choosing your Xero accounts before sending invoices.';
  } else if (overallStatus === 'ready_to_invoice') {
    statusDetail = 'Invoices created in Provvy will automatically sync to Xero.';
  } else {
    statusDetail = 'Invoices and payments will sync to Xero automatically.';
  }

  let nextAction: XeroReadinessNextAction | null = null;
  if (!connected) {
    nextAction = { label: 'Connect Xero', sectionId: 'xero-connection' };
  } else if (!tenantSelected) {
    nextAction = { label: 'Select Xero business', sectionId: 'xero-connection' };
  } else if (!canCreateInvoice) {
    nextAction = {
      label: 'Choose Xero accounts',
      sectionId: 'advanced-accounting-settings',
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
  queue: { pendingCount: 0, hasRecentFailures: false },
  overallStatus: 'setup_incomplete',
  statusLabel: STATUS_LABELS.setup_incomplete,
  statusDetail: 'Connect Xero to send invoices from Provvy.',
  blockers: ['Connect Xero to send invoices from Provvy.'],
  recommendations: [],
  nextAction: { label: 'Connect Xero', sectionId: 'xero-connection' },
  canCreateInvoice: false,
};
