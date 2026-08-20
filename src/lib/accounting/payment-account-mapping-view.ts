/**
 * Canonical UI state for one Provvy ↔ Xero payment-account mapping.
 *
 * Persistence remains merchant_settings mapping fields (account codes).
 * This module only derives display state from that saved code + the current
 * Xero chart + existing recommendation matching. Cards, bulk link, and
 * checklists must consume this view instead of inferring independently.
 */

import {
  resolvePaymentAccountRecommendation,
  type PaymentAccountChartAccount,
  type PaymentAccountRecommendation,
} from '@/lib/accounting/payment-account-recommendations';
import type { SettlementUiAccountDefinition } from '@/lib/accounting/settlement-account-ui';
import type { MappingDisplayState } from '@/lib/commercial-os/xero-invoice-readiness';
import type { XeroMappingField } from '@/lib/accounting/recommended-accounting-config';

const GENERIC_FALLBACK_NAME_PATTERNS = [
  'suspense account',
  'suspense',
  'clearing account',
] as const;

function isGenericFallbackAccountName(name: string | null | undefined): boolean {
  const normalized = (name ?? '').trim().toLowerCase();
  if (!normalized) return false;
  return GENERIC_FALLBACK_NAME_PATTERNS.some(
    (pattern) => normalized === pattern || normalized.includes(pattern)
  );
}

export const PREFERRED_PAYMENT_ACCOUNT_TYPES = ['BANK', 'CURRENT', 'CURRLIAB'] as const;

/** User-facing mapping states. Names match existing backend semantics where they already exist. */
export type PaymentAccountMappingUiState =
  | 'linked'
  | 'recommended_found'
  | 'needs_link'
  | 'needs_create'
  | 'stale_mapping'
  | 'optional';

export type PaymentAccountMappingView = {
  state: PaymentAccountMappingUiState;
  recommendation: PaymentAccountRecommendation;
  persistedCode: string | null;
  persistedAccount: PaymentAccountChartAccount | null;
  candidateAccount: PaymentAccountChartAccount | null;
  heroAccount: PaymentAccountChartAccount | null;
  badgeLabel: string;
  complete: boolean;
  displayState: MappingDisplayState;
  showLinkedLabel: boolean;
  showFoundInXero: boolean;
  showStaleWarning: boolean;
  showCreatePanel: boolean;
  /** True only when the chart has no suitable existing account to link. */
  createIsRequired: boolean;
  hasSuitableExistingAccounts: boolean;
  pickerDefaultOpen: boolean;
  otherPickerAccounts: PaymentAccountChartAccount[];
  preferredTypeAccounts: PaymentAccountChartAccount[];
};

function isPreferredHoldingType(type: string): boolean {
  return PREFERRED_PAYMENT_ACCOUNT_TYPES.includes(
    type.trim().toUpperCase() as (typeof PREFERRED_PAYMENT_ACCOUNT_TYPES)[number]
  );
}

function isActiveAccount(account: PaymentAccountChartAccount): boolean {
  const status = (account.status ?? '').trim().toLowerCase();
  return !status || status === 'active';
}

function heroFromRecommendation(
  state: PaymentAccountMappingUiState,
  persistedAccount: PaymentAccountChartAccount | null,
  candidateAccount: PaymentAccountChartAccount | null
): PaymentAccountChartAccount | null {
  if (state === 'linked') {
    return persistedAccount;
  }
  if (
    state === 'recommended_found' ||
    state === 'needs_link' ||
    state === 'stale_mapping'
  ) {
    if (!candidateAccount || isGenericFallbackAccountName(candidateAccount.name)) {
      return null;
    }
    return candidateAccount;
  }
  return null;
}

function uiStateFromRecommendation(
  recommendation: PaymentAccountRecommendation,
  isRequired: boolean
): PaymentAccountMappingUiState {
  switch (recommendation.status) {
    case 'linked':
      return 'linked';
    case 'update_mapping':
      return 'stale_mapping';
    case 'found':
      return 'recommended_found';
    case 'choose_account':
      return 'needs_link';
    case 'create_in_xero':
      return isRequired ? 'needs_create' : 'optional';
  }
}

export function mappingDisplayStateFromUiState(
  state: PaymentAccountMappingUiState
): MappingDisplayState {
  switch (state) {
    case 'linked':
      return 'configured';
    case 'stale_mapping':
      return 'needs_review';
    case 'optional':
      return 'recommended';
    case 'recommended_found':
    case 'needs_link':
    case 'needs_create':
      return 'required';
  }
}

export function mappingUiBadgeLabel(state: PaymentAccountMappingUiState): string {
  switch (state) {
    case 'linked':
      return 'Linked';
    case 'recommended_found':
      return 'Found in Xero';
    case 'needs_link':
      return 'Choose account';
    case 'needs_create':
      return 'Not in Xero';
    case 'stale_mapping':
      return 'Needs attention';
    case 'optional':
      return 'Optional';
  }
}

export function buildPaymentAccountMappingView(
  accounts: PaymentAccountChartAccount[],
  definition: SettlementUiAccountDefinition,
  mappedCode?: string | null,
  isRequired = true
): PaymentAccountMappingView {
  const recommendation = resolvePaymentAccountRecommendation(accounts, definition, mappedCode);
  const persistedCode = mappedCode?.trim() || null;
  const persistedAccount =
    persistedCode && recommendation.status === 'linked'
      ? (accounts.find((account) => account.code.trim() === persistedCode && isActiveAccount(account)) ??
        null)
      : null;

  const state = uiStateFromRecommendation(recommendation, isRequired);
  const candidateAccount =
    recommendation.status === 'linked'
      ? persistedAccount
      : recommendation.recommendedAccount &&
          !isGenericFallbackAccountName(recommendation.recommendedAccount.name)
        ? recommendation.recommendedAccount
        : null;

  const preferredTypeAccounts = accounts.filter(
    (account) => isActiveAccount(account) && isPreferredHoldingType(account.type)
  );
  const hasSuitableExistingAccounts = preferredTypeAccounts.length > 0;
  const currentCode = (persistedAccount?.code ?? candidateAccount?.code ?? persistedCode ?? '').trim();
  const otherPickerAccounts = preferredTypeAccounts.filter(
    (account) => account.code.trim() !== currentCode
  );

  const createIsRequired = state === 'needs_create' && !hasSuitableExistingAccounts;
  const showCreatePanel =
    state === 'needs_create' || (state === 'stale_mapping' && !candidateAccount);
  const pickerDefaultOpen =
    state === 'needs_link' ||
    state === 'stale_mapping' ||
    (state === 'needs_create' && hasSuitableExistingAccounts);

  return {
    state,
    recommendation,
    persistedCode,
    persistedAccount,
    candidateAccount,
    heroAccount: heroFromRecommendation(state, persistedAccount, candidateAccount),
    badgeLabel: mappingUiBadgeLabel(state),
    complete: state === 'linked',
    displayState: mappingDisplayStateFromUiState(state),
    showLinkedLabel: state === 'linked',
    showFoundInXero: state === 'recommended_found',
    showStaleWarning: state === 'stale_mapping',
    showCreatePanel,
    createIsRequired,
    hasSuitableExistingAccounts,
    pickerDefaultOpen,
    otherPickerAccounts,
    preferredTypeAccounts,
  };
}

export type RecommendedPaymentMappingApplyResult = {
  nextMappings: Record<string, string | null | undefined>;
  appliedCount: number;
  alreadyLinkedCount: number;
  unresolvedCount: number;
};

/**
 * Idempotent bulk-link: write recommended chart codes into empty or stale fields.
 * Does not overwrite a mapping that already resolves to a current Xero account.
 */
export function applyRecommendedPaymentMappings(
  accounts: PaymentAccountChartAccount[],
  definitions: SettlementUiAccountDefinition[],
  currentMappings: Partial<Record<XeroMappingField, string | null | undefined>>
): RecommendedPaymentMappingApplyResult {
  const nextMappings: Record<string, string | null | undefined> = { ...currentMappings };
  let appliedCount = 0;
  let alreadyLinkedCount = 0;
  let unresolvedCount = 0;

  for (const definition of definitions) {
    const currentCode = currentMappings[definition.mappingField];
    const view = buildPaymentAccountMappingView(accounts, definition, currentCode);
    if (view.state === 'linked') {
      alreadyLinkedCount += 1;
      continue;
    }
    const candidate = view.candidateAccount;
    if (candidate?.code) {
      nextMappings[definition.mappingField] = candidate.code;
      appliedCount += 1;
      continue;
    }
    unresolvedCount += 1;
  }

  return { nextMappings, appliedCount, alreadyLinkedCount, unresolvedCount };
}

export function countLinkableRecommendedAccounts(
  views: PaymentAccountMappingView[]
): number {
  return views.filter((view) => view.candidateAccount && view.state !== 'linked').length;
}
