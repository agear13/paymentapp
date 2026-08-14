/**
 * Derives which settlement tokens are actually available for customer payment
 * from merchant wallet configuration (not every possible token globally).
 */

import { EVM_SETTLEMENT_TOKENS, type EvmSettlementToken } from '@/lib/evm/tokens';
import {
  isMultiCheckoutRailConfigured,
  type PaymentLinkRailSetupStatus,
} from '@/lib/payment-links/setup-status';

/** Tokens exposed on Hedera HashPack checkout (matches CREATION FX snapshots / payment-amounts API). */
export const HEDERA_CHECKOUT_SETTLEMENT_TOKENS = ['HBAR', 'USDC', 'USDT', 'AUDD'] as const;

export type PaymentSettlementToken = (typeof HEDERA_CHECKOUT_SETTLEMENT_TOKENS)[number];

export type MerchantPaymentCapabilities = {
  hederaConfigured: boolean;
  evmConfigured: boolean;
  enabledSettlementTokens: PaymentSettlementToken[];
};

function normalizeEvmToken(value: string): EvmSettlementToken | null {
  const normalized = value.trim().toUpperCase();
  return EVM_SETTLEMENT_TOKENS.includes(normalized as EvmSettlementToken)
    ? (normalized as EvmSettlementToken)
    : null;
}

/** Tokens customers can pay with given current Hedera / EVM wallet setup. */
export function deriveMerchantPaymentCapabilities(input: {
  railSetup: PaymentLinkRailSetupStatus;
  evmSupportedTokens?: string[] | null;
}): MerchantPaymentCapabilities {
  const hederaConfigured = isMultiCheckoutRailConfigured(input.railSetup, 'hedera');
  const evmConfigured = isMultiCheckoutRailConfigured(input.railSetup, 'evm_wallet');
  const tokens = new Set<PaymentSettlementToken>();

  if (hederaConfigured) {
    for (const token of HEDERA_CHECKOUT_SETTLEMENT_TOKENS) {
      tokens.add(token);
    }
  }

  if (evmConfigured) {
    const supported =
      input.evmSupportedTokens && input.evmSupportedTokens.length > 0
        ? input.evmSupportedTokens
        : [...EVM_SETTLEMENT_TOKENS];
    for (const raw of supported) {
      const token = normalizeEvmToken(raw);
      if (token) {
        tokens.add(token);
      }
    }
  }

  const enabledSettlementTokens = HEDERA_CHECKOUT_SETTLEMENT_TOKENS.filter((token) =>
    tokens.has(token)
  );

  return {
    hederaConfigured,
    evmConfigured,
    enabledSettlementTokens,
  };
}
