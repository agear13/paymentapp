/**
 * Shared Xero mapping duplicate validation (client + server).
 */

import { LEGACY_CRYPTO_MAPPING_FIELDS } from '@/lib/accounting/settlement-account-config';
import { resolveCryptoSettlementStrategy } from '@/lib/accounting/crypto-settlement-strategy';
import type { MerchantSettlementSettings } from '@/lib/accounting/settlement-account-types';

export type XeroMappingDuplicateInput = Partial<
  Record<
    | 'xero_revenue_account_id'
    | 'xero_receivable_account_id'
    | 'xero_stripe_clearing_account_id'
    | 'xero_wise_clearing_account_id'
    | 'xero_hbar_clearing_account_id'
    | 'xero_usdc_clearing_account_id'
    | 'xero_usdt_clearing_account_id'
    | 'xero_audd_clearing_account_id'
    | 'xero_fee_expense_account_id',
    string | null | undefined
  >
>;

const DISTINCT_ACCOUNT_FIELDS = [
  'xero_revenue_account_id',
  'xero_receivable_account_id',
  'xero_stripe_clearing_account_id',
  'xero_wise_clearing_account_id',
  'xero_fee_expense_account_id',
] as const;

function trimmed(value: string | null | undefined): string | null {
  const next = value?.trim();
  return next ? next : null;
}

function duplicateDistinctFieldsError(): { valid: false; error: string } {
  return {
    valid: false,
    error: 'Revenue, receivable, and payment holding accounts must each use a different Xero account',
  };
}

function duplicatePerAssetCryptoError(): { valid: false; error: string } {
  return {
    valid: false,
    error: 'Each clearing account must be mapped to a different Xero account',
  };
}

export function validateXeroMappingDuplicates(
  mappings: XeroMappingDuplicateInput
): { valid: boolean; error?: string } {
  const settings = mappings as MerchantSettlementSettings;
  const strategy = resolveCryptoSettlementStrategy(settings);

  const distinctCodes = DISTINCT_ACCOUNT_FIELDS.map((field) => ({
    field,
    code: trimmed(mappings[field]),
  })).filter((entry): entry is { field: (typeof DISTINCT_ACCOUNT_FIELDS)[number]; code: string } =>
    Boolean(entry.code)
  );

  const distinctCodeSet = new Set(distinctCodes.map((entry) => entry.code));
  if (distinctCodeSet.size !== distinctCodes.length) {
    return duplicateDistinctFieldsError();
  }

  const legacyCryptoCodes = LEGACY_CRYPTO_MAPPING_FIELDS.map((field) => ({
    field,
    code: trimmed(mappings[field]),
  })).filter((entry): entry is { field: (typeof LEGACY_CRYPTO_MAPPING_FIELDS)[number]; code: string } =>
    Boolean(entry.code)
  );

  if (legacyCryptoCodes.length === 0) {
    return { valid: true };
  }

  if (strategy === 'shared') {
    const sharedCodes = new Set(legacyCryptoCodes.map((entry) => entry.code));
    if (sharedCodes.size > 1) {
      return {
        valid: false,
        error:
          'Shared Digital Asset Holding uses one account for all crypto — each crypto field must map to the same Xero account',
      };
    }

    const sharedCode = legacyCryptoCodes[0]?.code;
    if (sharedCode && distinctCodeSet.has(sharedCode)) {
      return duplicateDistinctFieldsError();
    }

    return { valid: true };
  }

  const perAssetCodeSet = new Set(legacyCryptoCodes.map((entry) => entry.code));
  if (perAssetCodeSet.size !== legacyCryptoCodes.length) {
    return duplicatePerAssetCryptoError();
  }

  for (const entry of legacyCryptoCodes) {
    if (distinctCodeSet.has(entry.code)) {
      return duplicatePerAssetCryptoError();
    }
  }

  return { valid: true };
}
