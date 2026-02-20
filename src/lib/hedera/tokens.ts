/**
 * Payout token registry for Hedera HTS transfers.
 * Canonical destination for payees is Hedera Account ID (0.0.x); token IDs from env or constants.
 * Extensible: USDC first (MVP), then USDT, HBAR, AUDD — no swaps.
 */

import {
  CURRENT_NETWORK,
  TOKEN_IDS,
  TOKEN_CONFIG,
  type TokenType,
  type HederaNetwork,
} from './constants';

export type PayoutTokenSymbol = 'USDC' | 'USDT' | 'HBAR' | 'AUDD';

export interface PayoutTokenInfo {
  symbol: PayoutTokenSymbol;
  tokenId: string | null;
  decimals: number;
}

const NETWORK_KEY: 'MAINNET' | 'TESTNET' = CURRENT_NETWORK === 'mainnet' ? 'MAINNET' : 'TESTNET';

/** Env overrides for payout token IDs (optional). E.g. HEDERA_PAYOUT_USDC_TOKEN_ID, HEDERA_PAYOUT_AUDD_TOKEN_ID. Fallback: TOKEN_IDS[network]. */
function getTokenId(symbol: PayoutTokenSymbol): string | null {
  if (symbol === 'HBAR') return null;
  const envKey = `HEDERA_PAYOUT_${symbol}_TOKEN_ID`;
  const envId = process.env[envKey];
  if (envId) return envId;
  return (TOKEN_IDS[NETWORK_KEY] as Record<string, string>)[symbol] ?? null;
}

/** Registry: symbol -> tokenId + decimals for payout batches. Add USDT, AUDD, HBAR when needed. */
export function getPayoutTokenInfo(symbol: PayoutTokenSymbol): PayoutTokenInfo {
  const config = TOKEN_CONFIG[symbol as TokenType];
  const tokenId = getTokenId(symbol);
  return {
    symbol,
    tokenId,
    decimals: config?.decimals ?? 6,
  };
}

/** Map batch currency to HTS payout token. USD/USDC -> USDC; AUD/AUDD -> AUDD. */
export function getPayoutTokenForCurrency(currency: string): PayoutTokenInfo | null {
  const upper = currency.trim().toUpperCase();
  if (upper === 'USD' || upper === 'USDC') return getPayoutTokenInfo('USDC');
  if (upper === 'AUD' || upper === 'AUDD') return getPayoutTokenInfo('AUDD');
  return null;
}
