/**
 * Plain-English summaries for payment-account setup gaps (UI only).
 */

import type { MerchantPaymentCapabilities } from '@/lib/accounting/merchant-payment-capabilities';
import type { CryptoSettlementStrategy } from '@/lib/accounting/settlement-account-types';
import { LEGACY_CRYPTO_ASSET_SLOTS } from '@/lib/accounting/settlement-account-config';
import {
  readSettlementMappingCode,
  type MerchantSettlementSettings,
} from '@/lib/accounting/settlement-account-types';

function formatTokenList(tokens: readonly string[]): string {
  if (tokens.length === 0) return '';
  if (tokens.length === 1) return tokens[0]!;
  if (tokens.length === 2) return `${tokens[0]} and ${tokens[1]}`;
  return `${tokens.slice(0, -1).join(', ')}, and ${tokens[tokens.length - 1]}`;
}

/** Tokens enabled for payment that still lack a linked Xero holding account mapping. */
export function unmappedEnabledSettlementTokens(
  settings: MerchantPaymentSettings,
  capabilities: MerchantPaymentCapabilities,
  strategy: CryptoSettlementStrategy
): string[] {
  if (capabilities.enabledSettlementTokens.length === 0) {
    return [];
  }

  if (strategy === 'shared') {
    const sharedCode = LEGACY_CRYPTO_ASSET_SLOTS.map((slot) =>
      readSettlementMappingCode(settings, slot.mappingField)
    ).find(Boolean);
    return sharedCode ? [] : [...capabilities.enabledSettlementTokens];
  }

  return capabilities.enabledSettlementTokens.filter(
    (token) => {
      const slot = LEGACY_CRYPTO_ASSET_SLOTS.find((item) => item.asset === token);
      if (!slot) return true;
      return !readSettlementMappingCode(settings, slot.mappingField);
    }
  );
}

export type MerchantPaymentSettings = MerchantSettlementSettings & {
  crypto_settlement_strategy?: CryptoSettlementStrategy | null;
};

export function buildPaymentTokenAccountingSummary(
  settings: MerchantPaymentSettings,
  capabilities: MerchantPaymentCapabilities,
  strategy: CryptoSettlementStrategy
): string | null {
  const unmapped = unmappedEnabledSettlementTokens(settings, capabilities, strategy);
  if (unmapped.length === 0) {
    return null;
  }

  const tokenLabel = formatTokenList(unmapped);
  const accountLabel =
    strategy === 'shared'
      ? 'Digital Asset Holding account'
      : `${unmapped.length === 1 ? 'its Xero holding account' : 'their Xero holding accounts'}`;

  return `${tokenLabel} ${unmapped.length === 1 ? 'is' : 'are'} enabled for payments, but ${accountLabel} still need${unmapped.length === 1 ? 's' : ''} to be linked.`;
}

export function recommendsPerAssetCryptoStrategy(
  capabilities: MerchantPaymentCapabilities
): boolean {
  return capabilities.enabledSettlementTokens.length > 1;
}
