/**
 * Invoice-first Xero setup display logic (frontend only).
 */

import type { XeroMappingField } from '@/lib/accounting/recommended-accounting-config';
import {
  getClearingAccountsForUi,
  RECOMMENDED_STANDARD_MAPPINGS,
} from '@/lib/accounting/recommended-accounting-config';
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

  for (const field of INVOICE_REQUIRED_FIELDS) {
    states[field] = resolveMappingDisplayState(
      mappings?.[field],
      chartLoaded,
      chartAccountCodes,
      true
    );
  }

  if (rails.stripeEnabled) {
    states.xero_stripe_clearing_account_id = resolveMappingDisplayState(
      mappings?.xero_stripe_clearing_account_id,
      chartLoaded,
      chartAccountCodes,
      false
    );
    states.xero_fee_expense_account_id = resolveMappingDisplayState(
      mappings?.xero_fee_expense_account_id,
      chartLoaded,
      chartAccountCodes,
      false
    );
  }

  if (rails.stablecoinSettlementsEnabled) {
    for (const config of getClearingAccountsForUi(true)) {
      if (!config.requiresStablecoinRail) continue;
      states[config.mappingField] = resolveMappingDisplayState(
        mappings?.[config.mappingField as keyof XeroReadinessMappingsPayload],
        chartLoaded,
        chartAccountCodes,
        false
      );
    }
  }

  return states;
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
  const optionalFields: XeroMappingField[] = [];
  if (rails.stripeEnabled) {
    optionalFields.push('xero_stripe_clearing_account_id', 'xero_fee_expense_account_id');
  }
  if (rails.stablecoinSettlementsEnabled) {
    for (const config of getClearingAccountsForUi(true)) {
      if (config.requiresStablecoinRail) {
        optionalFields.push(config.mappingField);
      }
    }
  }

  return optionalFields.filter((field) => {
    const state = fieldStates[field];
    return state === 'recommended' || state === 'needs_review';
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
  fieldStates: Partial<Record<XeroMappingField, MappingDisplayState>>;
}): string {
  const { connected, tenantSelected, canSendInvoices, fieldStates } = params;

  if (!connected) {
    return 'Connect Xero below.';
  }
  if (!tenantSelected) {
    return 'Select your Xero business below.';
  }
  if (canSendInvoices) {
    return 'Invoices you create in Provvy will sync to Xero.';
  }

  const needsReview = INVOICE_REQUIRED_FIELDS.some(
    (field) => fieldStates[field] === 'needs_review'
  );
  if (needsReview) {
    return 'Fix invoice accounts marked Needs review below.';
  }

  return 'Choose invoice accounts below.';
}

export function mappingStateBadgeLabel(state: MappingDisplayState): string {
  switch (state) {
    case 'required':
      return 'Required';
    case 'configured':
      return 'Configured';
    case 'recommended':
      return 'Recommended';
    case 'needs_review':
      return 'Needs review';
  }
}

export const INVOICE_ACCOUNT_FIELDS = INVOICE_REQUIRED_FIELDS;

export const STANDARD_INVOICE_FIELD_CONFIGS = RECOMMENDED_STANDARD_MAPPINGS.filter((config) =>
  INVOICE_REQUIRED_FIELDS.includes(config.mappingField)
);
