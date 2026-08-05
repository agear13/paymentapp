/**
 * Clearing account resolver — maps payment rails + assets to settlement accounts.
 *
 * Delegates to settlement-account-resolver (single source of truth).
 */

import type { XeroMappingField } from '@/lib/accounting/recommended-accounting-config';
import type { PaymentMethod } from '@prisma/client';
import {
  normalizeSettlementPaymentRail,
  paymentMethodToSettlementRail,
  resolveSettlementAccount,
  SHARED_DIGITAL_HOLDING,
  STRIPE_HOLDING,
} from '@/lib/accounting/settlement-account-resolver';
import type { MerchantSettlementSettings } from '@/lib/accounting/settlement-account-types';
import {
  getPaymentRailByMethod,
  type PaymentRailId,
} from '@/lib/payments/payment-rail-registry';
import type { ClearingAccountMapping } from '@/lib/commercial-reconciliation/types';

export type CommercialClearingRailConfig = {
  railId: PaymentRailId;
  configKey: string;
  fallbackAccountName: string;
  fallbackMappingField: XeroMappingField | null;
  label: string;
};

export const COMMERCIAL_CLEARING_RAIL_CONFIG: readonly CommercialClearingRailConfig[] = [
  {
    railId: 'stripe',
    configKey: 'stripe_clearing',
    fallbackAccountName: STRIPE_HOLDING.accountName,
    fallbackMappingField: STRIPE_HOLDING.mappingField,
    label: STRIPE_HOLDING.accountName,
  },
  {
    railId: 'wise',
    configKey: 'wise_clearing',
    fallbackAccountName: 'Wise Holding',
    fallbackMappingField: 'xero_wise_clearing_account_id',
    label: 'Wise Holding',
  },
  {
    railId: 'manual_bank',
    configKey: 'bank_clearing',
    fallbackAccountName: 'Bank Holding',
    fallbackMappingField: null,
    label: 'Bank Holding',
  },
  {
    railId: 'crypto',
    configKey: 'digital_asset_clearing',
    fallbackAccountName: SHARED_DIGITAL_HOLDING.accountName,
    fallbackMappingField: SHARED_DIGITAL_HOLDING.mappingField,
    label: SHARED_DIGITAL_HOLDING.accountName,
  },
  {
    railId: 'hedera',
    configKey: 'digital_asset_clearing',
    fallbackAccountName: SHARED_DIGITAL_HOLDING.accountName,
    fallbackMappingField: SHARED_DIGITAL_HOLDING.mappingField,
    label: SHARED_DIGITAL_HOLDING.accountName,
  },
  {
    railId: 'evm_wallet',
    configKey: 'digital_asset_clearing',
    fallbackAccountName: SHARED_DIGITAL_HOLDING.accountName,
    fallbackMappingField: SHARED_DIGITAL_HOLDING.mappingField,
    label: SHARED_DIGITAL_HOLDING.accountName,
  },
] as const;

function configForRail(railId: PaymentRailId): CommercialClearingRailConfig {
  const normalized = normalizeSettlementPaymentRail(railId);
  return (
    COMMERCIAL_CLEARING_RAIL_CONFIG.find((c) => c.railId === normalized) ??
    COMMERCIAL_CLEARING_RAIL_CONFIG.find((c) => c.railId === 'crypto')!
  );
}

function overridesToSettings(
  overrides?: Partial<Record<XeroMappingField, string>>
): MerchantSettlementSettings {
  return {
    xero_stripe_clearing_account_id: overrides?.xero_stripe_clearing_account_id,
    xero_wise_clearing_account_id: overrides?.xero_wise_clearing_account_id,
    xero_hbar_clearing_account_id: overrides?.xero_hbar_clearing_account_id,
    xero_usdc_clearing_account_id: overrides?.xero_usdc_clearing_account_id,
    xero_usdt_clearing_account_id: overrides?.xero_usdt_clearing_account_id,
    xero_audd_clearing_account_id: overrides?.xero_audd_clearing_account_id,
  };
}

export function deriveClearingAccount(
  paymentRail: PaymentRailId,
  overrides?: Partial<Record<XeroMappingField, string>>,
  paymentAsset?: string | null,
  collectionMethod?: string | null
): ClearingAccountMapping {
  const railConfig = configForRail(paymentRail);
  const settings = overridesToSettings(overrides);
  const resolution = resolveSettlementAccount({
    paymentRail,
    collectionMethod,
    paymentAsset,
    settings,
  });

  const mappingField =
    resolution.status === 'resolved'
      ? resolution.mappingField
      : resolution.target.mappingField ?? railConfig.fallbackMappingField;
  const defaultAccountName = resolution.target.accountName ?? railConfig.fallbackAccountName;
  const configuredAccountCode =
    resolution.status === 'resolved' ? resolution.xeroAccountCode : null;

  return {
    railId: normalizeSettlementPaymentRail(paymentRail) as PaymentRailId,
    configKey: railConfig.configKey,
    defaultAccountName,
    mappingField,
    label: defaultAccountName,
    configuredAccountCode,
    paymentAsset: paymentAsset ?? resolution.target.paymentAsset ?? null,
    collectionMethod: collectionMethod ?? resolution.target.collectionMethod ?? null,
  };
}

export function deriveClearingAccountFromPaymentMethod(
  method: PaymentMethod | string | null | undefined,
  overrides?: Partial<Record<XeroMappingField, string>>,
  paymentAsset?: string | null,
  collectionMethod?: string | null
): ClearingAccountMapping | null {
  if (!method) return null;
  const rail = getPaymentRailByMethod(method as PaymentMethod);
  if (!rail) return null;
  return deriveClearingAccount(rail.id, overrides, paymentAsset, collectionMethod);
}

export function listClearingAccountMappings(
  overrides?: Partial<Record<XeroMappingField, string>>
): ClearingAccountMapping[] {
  const railIds = COMMERCIAL_CLEARING_RAIL_CONFIG.map((c) => c.railId);
  const unique = [...new Set(railIds.map((id) => normalizeSettlementPaymentRail(id)))];
  return unique.map((railId) =>
    deriveClearingAccount(railId as PaymentRailId, overrides)
  );
}

export { paymentMethodToSettlementRail };
