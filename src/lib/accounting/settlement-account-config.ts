/**
 * Settlement account configuration — data layer only.
 * Resolver reads this; no asset-specific logic belongs in the resolver.
 */

import type { SettlementClearingMappingField } from '@/lib/accounting/settlement-account-types';

export type CryptoAssetSlot = {
  asset: string;
  mappingField: SettlementClearingMappingField;
  suggestedCode: string;
};

/** Legacy merchant_settings columns — storage slots, not resolver special cases. */
export const LEGACY_CRYPTO_ASSET_SLOTS: readonly CryptoAssetSlot[] = [
  { asset: 'HBAR', mappingField: 'xero_hbar_clearing_account_id', suggestedCode: '1051' },
  { asset: 'USDC', mappingField: 'xero_usdc_clearing_account_id', suggestedCode: '1052' },
  { asset: 'USDT', mappingField: 'xero_usdt_clearing_account_id', suggestedCode: '1053' },
  { asset: 'AUDD', mappingField: 'xero_audd_clearing_account_id', suggestedCode: '1054' },
];

export const LEGACY_CRYPTO_MAPPING_FIELDS: readonly SettlementClearingMappingField[] =
  LEGACY_CRYPTO_ASSET_SLOTS.map((slot) => slot.mappingField);

export const STRIPE_HOLDING = {
  accountName: 'Stripe Holding',
  mappingField: 'xero_stripe_clearing_account_id' as const,
  suggestedCode: '1050',
};

export const WISE_HOLDING = {
  accountName: 'Wise Holding',
  mappingField: 'xero_wise_clearing_account_id' as const,
  suggestedCode: '1055',
};

export const SHARED_DIGITAL_HOLDING = {
  accountName: 'Digital Asset Holding',
  mappingField: 'xero_hbar_clearing_account_id' as const,
  suggestedCode: '1060',
};

export function cryptoSlotForAsset(asset: string): CryptoAssetSlot | undefined {
  const normalized = asset.trim().toUpperCase();
  return LEGACY_CRYPTO_ASSET_SLOTS.find((slot) => slot.asset === normalized);
}

export function firstEmptyCryptoSlot(
  readCode: (field: SettlementClearingMappingField) => string | null
): CryptoAssetSlot | undefined {
  return LEGACY_CRYPTO_ASSET_SLOTS.find((slot) => !readCode(slot.mappingField));
}
