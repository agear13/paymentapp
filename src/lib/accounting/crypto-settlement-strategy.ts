/**
 * Crypto settlement strategy — shared vs per_asset.
 * No DB column yet: inferred from existing mappings; explicit override when present.
 */

import { LEGACY_CRYPTO_MAPPING_FIELDS } from '@/lib/accounting/settlement-account-config';
import {
  readSettlementMappingCode,
  type CryptoSettlementStrategy,
  type MerchantSettlementSettings,
} from '@/lib/accounting/settlement-account-types';

function configuredCryptoCodes(settings: MerchantSettlementSettings): string[] {
  return LEGACY_CRYPTO_MAPPING_FIELDS.map((field) =>
    readSettlementMappingCode(settings, field)
  ).filter((code): code is string => Boolean(code));
}

/** Infer strategy from legacy merchant_settings columns (backwards compatible). */
export function inferCryptoSettlementStrategy(
  settings: MerchantSettlementSettings
): CryptoSettlementStrategy {
  const configuredFields = LEGACY_CRYPTO_MAPPING_FIELDS.filter((field) =>
    Boolean(readSettlementMappingCode(settings, field))
  );
  if (configuredFields.length === 0) {
    return 'shared';
  }

  const uniqueCodes = new Set(configuredCryptoCodes(settings));

  if (uniqueCodes.size > 1) {
    return 'per_asset';
  }

  // Multiple legacy columns mapped to the same code → shared digital asset holding.
  if (uniqueCodes.size === 1 && configuredFields.length > 1) {
    return 'shared';
  }

  // Single configured token column — legacy per-asset merchant.
  return 'per_asset';
}

export function resolveCryptoSettlementStrategy(
  settings: MerchantSettlementSettings
): CryptoSettlementStrategy {
  if (
    settings.cryptoSettlementStrategy === 'shared' ||
    settings.cryptoSettlementStrategy === 'per_asset'
  ) {
    return settings.cryptoSettlementStrategy;
  }
  return inferCryptoSettlementStrategy(settings);
}

export function isSharedCryptoStrategy(settings: MerchantSettlementSettings): boolean {
  return resolveCryptoSettlementStrategy(settings) === 'shared';
}
