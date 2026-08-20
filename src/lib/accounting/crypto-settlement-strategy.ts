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
  const explicit =
    settings.cryptoSettlementStrategy ?? settings.crypto_settlement_strategy ?? null;
  if (explicit === 'shared' || explicit === 'per_asset') {
    return explicit;
  }
  return inferCryptoSettlementStrategy(settings);
}

export function isSharedCryptoStrategy(settings: MerchantSettlementSettings): boolean {
  return resolveCryptoSettlementStrategy(settings) === 'shared';
}

/**
 * Persist a strategy that matches the codes actually being saved.
 * Distinct per-token codes must not fail the whole save merely because the
 * selector was still on "shared" or the column was unset.
 */
export function withSaveableCryptoSettlementStrategy<T extends MerchantSettlementSettings>(
  mappings: T
): T {
  const inferred = inferCryptoSettlementStrategy(mappings);
  const explicit =
    mappings.cryptoSettlementStrategy ?? mappings.crypto_settlement_strategy ?? null;

  if (explicit === 'shared' && inferred === 'per_asset') {
    return {
      ...mappings,
      crypto_settlement_strategy: 'per_asset',
      cryptoSettlementStrategy: 'per_asset',
    };
  }

  if (explicit === 'shared' || explicit === 'per_asset') {
    return {
      ...mappings,
      crypto_settlement_strategy: explicit,
      cryptoSettlementStrategy: explicit,
    };
  }

  return {
    ...mappings,
    crypto_settlement_strategy: inferred,
    cryptoSettlementStrategy: inferred,
  };
}
