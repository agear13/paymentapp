/**
 * Invoice-first Xero setup display logic (frontend only).
 */

import type { XeroMappingField } from '@/lib/accounting/recommended-accounting-config';
import { RECOMMENDED_STANDARD_MAPPINGS } from '@/lib/accounting/recommended-accounting-config';
import {
  canResolveSettlementAccount,
  getSettlementAccountsForUi,
} from '@/lib/accounting/settlement-account-ui';
import type { MerchantSettlementSettings } from '@/lib/accounting/settlement-account-types';
import type { MerchantPaymentRails } from '@/lib/xero/xero-setup-guidance';
import type { XeroReadinessMappingsPayload } from '@/lib/commercial-os/xero-readiness';

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

function railsWithDefaults(rails: MerchantPaymentRails): MerchantPaymentRails {
  return {
    ...rails,
    manualBankEnabled: rails.manualBankEnabled ?? true,
  };
}

function asSettlementSettings(
  mappings: XeroReadinessMappingsPayload | null
): MerchantSettlementSettings {
  return mappings ?? {};
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
  if (chartLoaded && chartAccountCodes && !chartAccountCodes.has(value)) {
    return 'needs_review';
  }
  return 'configured';
}

export function buildMappingFieldStates(
  mappings: XeroReadinessMappingsPayload | null,
  chartLoaded: boolean,
  chartAccountCodes: Set<string> | null,
  rails: MerchantPaymentRails
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

  for (const definition of getSettlementAccountsForUi(settings, normalizedRails)) {
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
  rails: MerchantPaymentRails
): boolean {
  const normalizedRails = railsWithDefaults(rails);
  const settings = asSettlementSettings(mappings);
  const definitions = getSettlementAccountsForUi(settings, normalizedRails);

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
  rails: MerchantPaymentRails
): boolean {
  const normalizedRails = railsWithDefaults(rails);

  return getSettlementAccountsForUi({}, normalizedRails).some((definition) => {
    const state = fieldStates[definition.mappingField];
    return state === 'required' || state === 'needs_review';
  });
}

export function countSettlementAccountActions(
  fieldStates: Partial<Record<XeroMappingField, MappingDisplayState>>,
  rails: MerchantPaymentRails
): number {
  const normalizedRails = railsWithDefaults(rails);

  return getSettlementAccountsForUi({}, normalizedRails).filter((definition) => {
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

export type HeroAnswer = 'Yes' | 'Not yet';

export function computeHeroSubline(params: {
  connected: boolean;
  tenantSelected: boolean;
  canSendInvoices: boolean;
  settlementReady: boolean;
  fieldStates: Partial<Record<XeroMappingField, MappingDisplayState>>;
}): string {
  const { connected, tenantSelected, canSendInvoices, settlementReady, fieldStates } = params;

  if (!connected) {
    return 'Connect Xero first — use the section below.';
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

  if (!settlementReady) {
    return 'Choose where payments are recorded in Xero — open "Where payments go" below.';
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
