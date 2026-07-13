/**
 * Clearing account resolver — maps payment rails to configurable clearing accounts.
 *
 * Never hardcodes Xero account codes. Uses recommended accounting config as defaults.
 */

import {
  RECOMMENDED_CLEARING_ACCOUNTS,
  type RecommendedClearingAccountConfig,
  type XeroMappingField,
} from '@/lib/accounting/recommended-accounting-config';
import type { PaymentMethod } from '@prisma/client';
import {
  getPaymentRailByMethod,
  type PaymentRailId,
} from '@/lib/payments/payment-rail-registry';
import type { ClearingAccountMapping } from '@/lib/commercial-reconciliation/types';

/** Rail → clearing config mapping. Extend when adding payment rails. */
export type CommercialClearingRailConfig = {
  railId: PaymentRailId;
  configKey: string;
  /** Match RECOMMENDED_CLEARING_ACCOUNTS.rail or fallback label. */
  recommendedRailLabel: string;
  fallbackAccountName: string;
  fallbackMappingField: XeroMappingField | null;
  label: string;
};

export const COMMERCIAL_CLEARING_RAIL_CONFIG: readonly CommercialClearingRailConfig[] = [
  {
    railId: 'stripe',
    configKey: 'stripe_clearing',
    recommendedRailLabel: 'Stripe',
    fallbackAccountName: 'Stripe Clearing',
    fallbackMappingField: 'xero_stripe_clearing_account_id',
    label: 'Stripe Clearing',
  },
  {
    railId: 'wise',
    configKey: 'wise_clearing',
    recommendedRailLabel: 'Wise',
    fallbackAccountName: 'Wise Clearing',
    fallbackMappingField: 'xero_wise_clearing_account_id',
    label: 'Wise Clearing',
  },
  {
    railId: 'manual_bank',
    configKey: 'bank_clearing',
    recommendedRailLabel: 'Bank',
    fallbackAccountName: 'Bank Clearing',
    fallbackMappingField: null,
    label: 'Bank Clearing',
  },
  {
    railId: 'hedera',
    configKey: 'crypto_clearing',
    recommendedRailLabel: 'HBAR',
    fallbackAccountName: 'Crypto Clearing',
    fallbackMappingField: 'xero_hbar_clearing_account_id',
    label: 'Crypto Clearing',
  },
  {
    railId: 'evm_wallet',
    configKey: 'crypto_clearing',
    recommendedRailLabel: 'USDC',
    fallbackAccountName: 'Crypto Clearing',
    fallbackMappingField: 'xero_usdc_clearing_account_id',
    label: 'Crypto Clearing',
  },
  {
    railId: 'crypto',
    configKey: 'crypto_clearing',
    recommendedRailLabel: 'Crypto',
    fallbackAccountName: 'Crypto Clearing',
    fallbackMappingField: null,
    label: 'Crypto Clearing',
  },
] as const;

function findRecommendedClearing(
  recommendedRailLabel: string
): RecommendedClearingAccountConfig | undefined {
  return RECOMMENDED_CLEARING_ACCOUNTS.find(
    (c) => c.rail.toLowerCase() === recommendedRailLabel.toLowerCase()
  );
}

function configForRail(railId: PaymentRailId): CommercialClearingRailConfig {
  return (
    COMMERCIAL_CLEARING_RAIL_CONFIG.find((c) => c.railId === railId) ??
    COMMERCIAL_CLEARING_RAIL_CONFIG.find((c) => c.railId === 'manual_bank')!
  );
}

/** Resolve clearing account mapping for a payment rail. */
export function deriveClearingAccount(
  paymentRail: PaymentRailId,
  overrides?: Partial<Record<XeroMappingField, string>>
): ClearingAccountMapping {
  const railConfig = configForRail(paymentRail);
  const recommended = findRecommendedClearing(railConfig.recommendedRailLabel);

  const mappingField =
    recommended?.mappingField ?? railConfig.fallbackMappingField;
  const defaultAccountName =
    recommended?.accountName ?? railConfig.fallbackAccountName;
  const label = recommended?.summaryLabel ?? railConfig.label;

  const configuredAccountCode =
    mappingField && overrides?.[mappingField]
      ? overrides[mappingField]!
      : null;

  return {
    railId: paymentRail,
    configKey: railConfig.configKey,
    defaultAccountName,
    mappingField,
    label,
    configuredAccountCode,
  };
}

/** Resolve clearing account from Prisma PaymentMethod. */
export function deriveClearingAccountFromPaymentMethod(
  method: PaymentMethod | string | null | undefined,
  overrides?: Partial<Record<XeroMappingField, string>>
): ClearingAccountMapping | null {
  const rail = getPaymentRailByMethod(method);
  if (!rail) return null;
  return deriveClearingAccount(rail.id, overrides);
}

/** All clearing account mappings for reporting extension points. */
export function listClearingAccountMappings(
  overrides?: Partial<Record<XeroMappingField, string>>
): ClearingAccountMapping[] {
  const railIds = COMMERCIAL_CLEARING_RAIL_CONFIG.map((c) => c.railId);
  const unique = [...new Set(railIds)];
  return unique.map((railId) => deriveClearingAccount(railId, overrides));
}
