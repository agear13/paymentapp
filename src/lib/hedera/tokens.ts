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

/** Env overrides for payout token IDs (optional). Example: HEDERA_PAYOUT_USDC_TOKEN_ID=0.0.429274 */
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

/** MVP: only USDC supported for on-chain payout. Batch currency USD -> USDC. */
export function getPayoutTokenForCurrency(currency: string): PayoutTokenInfo | null {
  const upper = currency.toUpperCase();
  if (upper === 'USD') return getPayoutTokenInfo('USDC');
  if (upper === 'USDC') return getPayoutTokenInfo('USDC');
  // Future: USDT, AUDD, HBAR when batch currency matches
  return null;
}
