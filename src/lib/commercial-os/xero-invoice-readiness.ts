/**
 * Invoice-first Xero setup display logic (frontend only).
 */

import type { XeroMappingField } from '@/lib/accounting/recommended-accounting-config';
import { RECOMMENDED_STANDARD_MAPPINGS } from '@/lib/accounting/recommended-accounting-config';
import type { MerchantPaymentCapabilities } from '@/lib/accounting/merchant-payment-capabilities';
import {
  canResolveSettlementAccount,
  getSettlementAccountsForUi,
} from '@/lib/accounting/settlement-account-ui';
import { toMerchantSettlementSettings } from '@/lib/accounting/settlement-settings-mapper';
import type { MerchantSettlementSettings } from '@/lib/accounting/settlement-account-types';
import type { MerchantPaymentRails } from '@/lib/xero/xero-setup-guidance';
import type { XeroReadinessMappingsPayload } from '@/lib/commercial-os/xero-readiness';
import { normalizeMerchantPaymentRails } from '@/lib/commercial-os/merchant-payment-rails';

export type MappingDisplayState = 'required' | 'configured' | 'recommended' | 'needs_review';

export type XeroRecentSync = {
  id: string;
  payment_link_id: string;
  sync_type: string;
  status: string;
  retry_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

const INVOICE_REQUIRED_FIELDS: XeroMappingField[] = [
  'xero_revenue_account_id',
  'xero_receivable_account_id',
];

const ACTIVE_QUEUE_STATUSES = new Set(['PENDING', 'RETRYING', 'FAILED']);

function trimmed(code: string | null | undefined): string | null {
  const value = code?.trim();
  return value ? value : null;
}

function isActiveChartAccount(status: string | null | undefined): boolean {
  const value = (status ?? '').trim().toLowerCase();
  return !value || value === 'active';
}

/** Active Xero account codes, trimmed — shared by mapping UI and readiness. */
export function chartAccountCodeSet(
  accounts: Array<{ code?: string | null; status?: string | null }>
): Set<string> {
  return new Set(
    accounts
      .filter((account) => isActiveChartAccount(account.status))
      .map((account) => trimmed(account.code))
      .filter((code): code is string => Boolean(code))
  );
}

function railsWithDefaults(rails: MerchantPaymentRails): MerchantPaymentRails {
  return normalizeMerchantPaymentRails(rails);
}

function asSettlementSettings(
  mappings: XeroReadinessMappingsPayload | null
): MerchantSettlementSettings {
  return toMerchantSettlementSettings(mappings);
}

function settlementDefinitions(
  mappings: XeroReadinessMappingsPayload | null,
  rails: MerchantPaymentRails,
  capabilities?: MerchantPaymentCapabilities | null
) {
  return getSettlementAccountsForUi(
    asSettlementSettings(mappings),
    railsWithDefaults(rails),
    capabilities
  );
}

export function resolveMappingDisplayState(
  code: string | null | undefined,
  chartLoaded: boolean,
  chartAccountCodes: Set<string> | null,
  isRequired: boolean
): MappingDisplayState {
  const value = trimmed(code);
  if (!value) {
    return isRequired ? 'required' : 'recommended';
  }
  if (!chartLoaded || !chartAccountCodes) {
    return isRequired ? 'required' : 'recommended';
  }
  if (!chartAccountCodes.has(value)) {
    return 'needs_review';
  }
  return 'configured';
}

export function buildMappingFieldStates(
  mappings: XeroReadinessMappingsPayload | null,
  chartLoaded: boolean,
  chartAccountCodes: Set<string> | null,
  rails: MerchantPaymentRails,
  capabilities?: MerchantPaymentCapabilities | null
): Partial<Record<XeroMappingField, MappingDisplayState>> {
  const states: Partial<Record<XeroMappingField, MappingDisplayState>> = {};
  const normalizedRails = railsWithDefaults(rails);
  const settings = asSettlementSettings(mappings);

  for (const field of INVOICE_REQUIRED_FIELDS) {
    states[field] = resolveMappingDisplayState(
      mappings?.[field],
      chartLoaded,
      chartAccountCodes,
      true
    );
  }

  for (const definition of settlementDefinitions(mappings, normalizedRails, capabilities)) {
    states[definition.mappingField] = resolveMappingDisplayState(
      mappings?.[definition.mappingField as keyof XeroReadinessMappingsPayload],
      chartLoaded,
      chartAccountCodes,
      true
    );
  }

  if (normalizedRails.stripeEnabled) {
    states.xero_fee_expense_account_id = resolveMappingDisplayState(
      mappings?.xero_fee_expense_account_id,
      chartLoaded,
      chartAccountCodes,
      false
    );
  }

  return states;
}

/** True when every enabled payment rail can resolve a holding account. */
export function settlementAccountsReady(
  mappings: XeroReadinessMappingsPayload | null,
  rails: MerchantPaymentRails,
  capabilities?: MerchantPaymentCapabilities | null
): boolean {
  const normalizedRails = railsWithDefaults(rails);
  const settings = asSettlementSettings(mappings);
  const definitions = settlementDefinitions(mappings, normalizedRails, capabilities);

  if (definitions.length === 0) {
    return true;
  }

  return definitions.every((definition) =>
    canResolveSettlementAccount(
      settings,
      definition.paymentRail ?? 'crypto',
      definition.paymentAsset,
      definition.paymentAsset ? null : null
    )
  );
}

export function filterPostConnectSyncs(
  syncs: XeroRecentSync[],
  connectedAt: string | null | undefined
): XeroRecentSync[] {
  if (!connectedAt) return [];
  const cutoff = new Date(connectedAt).getTime();
  if (Number.isNaN(cutoff)) return [];

  return syncs.filter((sync) => {
    const created = new Date(sync.created_at).getTime();
    return !Number.isNaN(created) && created >= cutoff && ACTIVE_QUEUE_STATUSES.has(sync.status);
  });
}

export function shouldShowPastPayments(
  syncs: XeroRecentSync[],
  connectedAt: string | null | undefined
): boolean {
  return filterPostConnectSyncs(syncs, connectedAt).length > 0;
}

export function countOptionalRecommended(
  fieldStates: Partial<Record<XeroMappingField, MappingDisplayState>>,
  rails: MerchantPaymentRails
): number {
  if (!rails.stripeEnabled) {
    return 0;
  }

  const state = fieldStates.xero_fee_expense_account_id;
  return state === 'recommended' || state === 'needs_review' ? 1 : 0;
}

export function settlementAccountsNeedAction(
  fieldStates: Partial<Record<XeroMappingField, MappingDisplayState>>,
  rails: MerchantPaymentRails,
  mappings?: XeroReadinessMappingsPayload | null,
  capabilities?: MerchantPaymentCapabilities | null
): boolean {
  const normalizedRails = railsWithDefaults(rails);

  return settlementDefinitions(mappings ?? null, normalizedRails, capabilities).some((definition) => {
    const state = fieldStates[definition.mappingField];
    return state === 'required' || state === 'needs_review';
  });
}

export function countSettlementAccountActions(
  fieldStates: Partial<Record<XeroMappingField, MappingDisplayState>>,
  rails: MerchantPaymentRails,
  mappings?: XeroReadinessMappingsPayload | null,
  capabilities?: MerchantPaymentCapabilities | null
): number {
  const normalizedRails = railsWithDefaults(rails);

  return settlementDefinitions(mappings ?? null, normalizedRails, capabilities).filter((definition) => {
    const state = fieldStates[definition.mappingField];
    return state === 'required' || state === 'needs_review';
  }).length;
}

export function invoiceAccountsNeedAction(
  fieldStates: Partial<Record<XeroMappingField, MappingDisplayState>>
): boolean {
  return INVOICE_REQUIRED_FIELDS.some((field) => {
    const state = fieldStates[field];
    return state === 'required' || state === 'needs_review';
  });
}

export function countInvoiceAccountActions(
  fieldStates: Partial<Record<XeroMappingField, MappingDisplayState>>
): number {
  return INVOICE_REQUIRED_FIELDS.filter((field) => {
    const state = fieldStates[field];
    return state === 'required' || state === 'needs_review';
  }).length;
}

export function allInvoiceAccountsConfigured(
  fieldStates: Partial<Record<XeroMappingField, MappingDisplayState>>
): boolean {
  return INVOICE_REQUIRED_FIELDS.every((field) => fieldStates[field] === 'configured');
}

export type PaymentAccountingStatus =
  | 'not_applicable'
  | 'unconfigured'
  | 'partial'
  | 'complete';

export function computePaymentAccountingStatus(
  fieldStates: Partial<Record<XeroMappingField, MappingDisplayState>>,
  rails: MerchantPaymentRails,
  mappings?: XeroReadinessMappingsPayload | null,
  capabilities?: MerchantPaymentCapabilities | null
): PaymentAccountingStatus {
  const definitions = settlementDefinitions(mappings ?? null, railsWithDefaults(rails), capabilities);
  if (definitions.length === 0) {
    return 'not_applicable';
  }

  const configuredCount = definitions.filter(
    (definition) => fieldStates[definition.mappingField] === 'configured'
  ).length;

  if (configuredCount === 0) {
    return 'unconfigured';
  }
  if (configuredCount < definitions.length) {
    return 'partial';
  }
  return 'complete';
}

export function paymentAccountingStatusLabel(status: PaymentAccountingStatus): string {
  switch (status) {
    case 'not_applicable':
      return 'Not applicable';
    case 'unconfigured':
      return 'Not configured';
    case 'partial':
      return 'Partially configured';
    case 'complete':
      return 'Configured';
  }
}

export type HeroAnswer = 'Yes' | 'Not yet';

export function computeHeroSubline(params: {
  connected: boolean;
  tenantSelected: boolean;
  canSendInvoices: boolean;
  settlementReady: boolean;
  fieldStates: Partial<Record<XeroMappingField, MappingDisplayState>>;
}): string {
  const { connected, tenantSelected, canSendInvoices, fieldStates } = params;

  if (!connected) {
    return 'Connect accounting to sync invoices automatically.';
  }
  if (!tenantSelected) {
    return 'Choose which Xero business Provvy should use.';
  }
  if (canSendInvoices) {
    return "You're set. Invoices you create in Provvy will appear in Xero automatically.";
  }

  const needsReview = INVOICE_REQUIRED_FIELDS.some(
    (field) => fieldStates[field] === 'needs_review'
  );
  if (needsReview) {
    return 'Update the invoice accounts marked "Needs fixing" below.';
  }

  return 'Choose where invoices are recorded in Xero — open "Where invoices go" below.';
}

export function mappingStateBadgeLabel(state: MappingDisplayState): string {
  switch (state) {
    case 'required':
      return 'Required';
    case 'configured':
      return 'Done';
    case 'recommended':
      return 'Optional';
    case 'needs_review':
      return 'Needs fixing';
  }
}

export const INVOICE_ACCOUNT_FIELDS = INVOICE_REQUIRED_FIELDS;

export const STANDARD_INVOICE_FIELD_CONFIGS = RECOMMENDED_STANDARD_MAPPINGS.filter((config) =>
  INVOICE_REQUIRED_FIELDS.includes(config.mappingField)
);
