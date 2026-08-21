/**
 * Manage Xero setup summary — presentation of invoice vs payment vs historical
 * state. Does not change invoice-readiness (canSyncToAccounting).
 */

import { getSettlementAccountsForUi } from '@/lib/accounting/settlement-account-ui';
import { toMerchantSettlementSettings } from '@/lib/accounting/settlement-settings-mapper';
import type { MerchantPaymentCapabilities } from '@/lib/accounting/merchant-payment-capabilities';
import type { MerchantPaymentRails } from '@/lib/xero/xero-setup-guidance';
import {
  computePaymentAccountingStatus,
  paymentAccountingStatusLabel,
  type MappingDisplayState,
  type PaymentAccountingStatus,
} from '@/lib/commercial-os/xero-invoice-readiness';
import type {
  XeroReadinessMappingsPayload,
  XeroReadinessResult,
} from '@/lib/commercial-os/xero-readiness';

export type XeroSetupInvoiceStep = {
  id: 'connected' | 'business_selected' | 'invoice_accounts';
  label: string;
  complete: boolean;
};

export type XeroSetupHoldingRow = {
  id: string;
  label: string;
  configured: boolean;
};

export type XeroSetupHistoricalStatus = 'not_reviewed' | 'pending' | 'needs_attention';

export type XeroSetupOverview = {
  invoiceReady: boolean;
  invoiceReadinessLabel: string;
  invoiceSteps: XeroSetupInvoiceStep[];
  payment: {
    status: PaymentAccountingStatus;
    statusLabel: string;
    configuredCount: number;
    totalCount: number;
    summary: string;
    holdings: XeroSetupHoldingRow[];
    unresolvedLabels: string[];
    unresolvedSummary: string | null;
  };
  historical: {
    status: XeroSetupHistoricalStatus;
    label: string;
  };
};

function holdingShortLabel(title: string, paymentAsset?: string | null, paymentRail?: string): string {
  if (paymentAsset?.trim()) {
    return paymentAsset.trim().toUpperCase();
  }
  if (paymentRail === 'stripe') return 'Stripe';
  if (paymentRail === 'wise') return 'Wise';
  if (/crypto payments land/i.test(title) || /digital asset/i.test(title)) {
    return 'Digital Asset';
  }
  return title.replace(/\s+Holding$/i, '').trim() || title;
}

function joinHoldingNames(labels: string[]): string {
  return labels.join(', ');
}

function paymentSummary(
  configuredCount: number,
  totalCount: number,
  status: PaymentAccountingStatus
): string {
  if (status === 'not_applicable' || totalCount === 0) {
    return paymentAccountingStatusLabel(status);
  }
  return `${configuredCount} of ${totalCount} configured · ${paymentAccountingStatusLabel(status)}`;
}

function historicalFromQueue(input: {
  pendingCount: number;
  hasRecentFailures: boolean;
}): XeroSetupOverview['historical'] {
  if (input.hasRecentFailures) {
    return { status: 'needs_attention', label: 'Needs attention' };
  }
  if (input.pendingCount > 0) {
    return {
      status: 'pending',
      label:
        input.pendingCount === 1
          ? 'Pending — 1 past payment waiting'
          : `Pending — ${input.pendingCount} past payments waiting`,
    };
  }
  return { status: 'not_reviewed', label: 'Not reviewed' };
}

export function computeXeroSetupOverview(input: {
  connected: boolean;
  tenantSelected: boolean;
  invoiceReady: boolean;
  invoiceAccountsConfigured: boolean;
  fieldStates: Partial<Record<string, MappingDisplayState>>;
  mappings: XeroReadinessMappingsPayload | null;
  merchantRails: MerchantPaymentRails;
  merchantPaymentCapabilities?: MerchantPaymentCapabilities | null;
  pendingCount: number;
  hasRecentFailures: boolean;
}): XeroSetupOverview {
  const settings = toMerchantSettlementSettings(input.mappings);
  const definitions = getSettlementAccountsForUi(
    settings,
    input.merchantRails,
    input.merchantPaymentCapabilities
  );
  const holdings: XeroSetupHoldingRow[] = definitions.map((definition) => ({
    id: definition.id,
    label: holdingShortLabel(definition.title, definition.paymentAsset, definition.paymentRail),
    configured: input.fieldStates[definition.mappingField] === 'configured',
  }));
  const configuredCount = holdings.filter((holding) => holding.configured).length;
  const status = computePaymentAccountingStatus(
    input.fieldStates,
    input.merchantRails,
    input.mappings,
    input.merchantPaymentCapabilities
  );
  const unresolvedLabels = holdings
    .filter((holding) => !holding.configured)
    .map((holding) => holding.label);

  return {
    invoiceReady: input.invoiceReady,
    invoiceReadinessLabel: input.invoiceReady ? 'Ready' : 'Not yet',
    invoiceSteps: [
      { id: 'connected', label: 'Xero connected', complete: input.connected },
      {
        id: 'business_selected',
        label: 'Xero business chosen',
        complete: input.connected && input.tenantSelected,
      },
      {
        id: 'invoice_accounts',
        label: 'Invoice accounts confirmed',
        complete: input.invoiceAccountsConfigured,
      },
    ],
    payment: {
      status,
      statusLabel: paymentAccountingStatusLabel(status),
      configuredCount,
      totalCount: holdings.length,
      summary: paymentSummary(configuredCount, holdings.length, status),
      holdings,
      unresolvedLabels,
      unresolvedSummary:
        unresolvedLabels.length > 0
          ? `${joinHoldingNames(unresolvedLabels)} still need holding accounts`
          : null,
    },
    historical: historicalFromQueue({
      pendingCount: input.pendingCount,
      hasRecentFailures: input.hasRecentFailures,
    }),
  };
}

export function computeXeroSetupOverviewFromReadiness(
  readiness: Omit<XeroReadinessResult, 'loading'>
): XeroSetupOverview {
  return computeXeroSetupOverview({
    connected: readiness.connection.connected,
    tenantSelected: readiness.connection.tenantSelected,
    invoiceReady: readiness.canSyncToAccounting,
    invoiceAccountsConfigured: readiness.allInvoiceAccountsConfigured,
    fieldStates: readiness.fieldStates,
    mappings: readiness.mappings,
    merchantRails: readiness.merchantRails,
    merchantPaymentCapabilities: readiness.merchantPaymentCapabilities,
    pendingCount: readiness.queue.pendingCount,
    hasRecentFailures: readiness.queue.hasRecentFailures,
  });
}
