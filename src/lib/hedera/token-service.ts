/**
 * Hedera Token Service
 * Handles token balances, associations, and HTS operations
 */

import { log } from '@/lib/logger';
import {
  TOKEN_CONFIG,
  CURRENT_MIRROR_URL,
  type TokenType,
} from './constants';
import type {
  TokenBalances,
  TokenAssociation,
  MirrorAccountBalance,
} from './types';

/**
 * Fetch all token balances for an account
 */
export async function getAccountBalances(
  accountId: string
): Promise<TokenBalances> {
  try {
    log.info({ accountId }, 'Fetching account balances');

    const url = `${CURRENT_MIRROR_URL}/api/v1/accounts/${accountId}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Mirror Node API error: ${response.status}`);
    }

    const data: MirrorAccountBalance = await response.json();

    // Get HBAR balance (convert from tinybars to HBAR)
    const hbarBalance = (data.balance.balance / 100000000).toFixed(8);

    // Get token balances
    const usdcToken = data.tokens.find(
      (t) => t.token_id === TOKEN_CONFIG.USDC.id
    );
    const usdtToken = data.tokens.find(
      (t) => t.token_id === TOKEN_CONFIG.USDT.id
    );
    const auddToken = data.tokens.find(
      (t) => t.token_id === TOKEN_CONFIG.AUDD.id
    );

    // Convert token amounts (divide by 10^decimals)
    const usdcBalance = usdcToken
      ? (usdcToken.balance / Math.pow(10, TOKEN_CONFIG.USDC.decimals)).toFixed(
          TOKEN_CONFIG.USDC.decimals
        )
      : '0.000000';

    const usdtBalance = usdtToken
      ? (usdtToken.balance / Math.pow(10, TOKEN_CONFIG.USDT.decimals)).toFixed(
          TOKEN_CONFIG.USDT.decimals
        )
      : '0.000000';

    const auddBalance = auddToken
      ? (auddToken.balance / Math.pow(10, TOKEN_CONFIG.AUDD.decimals)).toFixed(
          TOKEN_CONFIG.AUDD.decimals
        )
      : '0.000000';

    const balances: TokenBalances = {
      HBAR: hbarBalance,
      USDC: usdcBalance,
      USDT: usdtBalance,
      AUDD: auddBalance,
    };

    log.info({ accountId, balances }, 'Account balances fetched');

    return balances;
  } catch (error) {
    log.error({ error, accountId }, 'Failed to fetch account balances');
    
    // Return zero balances on error
    return {
      HBAR: '0.00000000',
      USDC: '0.000000',
      USDT: '0.000000',
      AUDD: '0.000000',
    };
  }
}

/**
 * Check token association status for USDC, USDT, and AUDD
 */
export async function checkTokenAssociations(
  accountId: string
): Promise<TokenAssociation[]> {
  try {
    log.info({ accountId }, 'Checking token associations');

    const url = `${CURRENT_MIRROR_URL}/api/v1/accounts/${accountId}/tokens`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Mirror Node API error: ${response.status}`);
    }

    const data = await response.json();
    const accountTokens = data.tokens || [];

    const associations: TokenAssociation[] = [
      {
        tokenId: TOKEN_CONFIG.USDC.id,
        symbol: 'USDC',
        isAssociated: accountTokens.some(
          (t: any) => t.token_id === TOKEN_CONFIG.USDC.id
        ),
        balance: '0',
      },
      {
        tokenId: TOKEN_CONFIG.USDT.id,
        symbol: 'USDT',
        isAssociated: accountTokens.some(
          (t: any) => t.token_id === TOKEN_CONFIG.USDT.id
        ),
        balance: '0',
      },
      {
        tokenId: TOKEN_CONFIG.AUDD.id,
        symbol: 'AUDD',
        isAssociated: accountTokens.some(
          (t: any) => t.token_id === TOKEN_CONFIG.AUDD.id
        ),
        balance: '0',
      },
    ];

    // Add balances for associated tokens
    accountTokens.forEach((token: any) => {
      const association = associations.find(
        (a) => a.tokenId === token.token_id
      );
      if (association) {
        const tokenConfig = TOKEN_CONFIG[association.symbol];
        association.balance = (
          token.balance / Math.pow(10, tokenConfig.decimals)
        ).toFixed(tokenConfig.decimals);
      }
    });

    log.info({ accountId, associations }, 'Token associations checked');

    return associations;
  } catch (error) {
    log.error({ error, accountId }, 'Failed to check token associations');
    
    // Return unassociated status on error
    return [
      {
        tokenId: TOKEN_CONFIG.USDC.id,
        symbol: 'USDC',
        isAssociated: false,
        balance: '0',
      },
      {
        tokenId: TOKEN_CONFIG.USDT.id,
        symbol: 'USDT',
        isAssociated: false,
        balance: '0',
      },
      {
        tokenId: TOKEN_CONFIG.AUDD.id,
        symbol: 'AUDD',
        isAssociated: false,
        balance: '0',
      },
    ];
  }
}

/**
 * Check if an account has sufficient balance for a token
 */
export function hasSufficientBalance(
  balances: TokenBalances,
  tokenType: TokenType,
  requiredAmount: number
): boolean {
  const balance = parseFloat(balances[tokenType]);
  return balance >= requiredAmount;
}

/**
 * Format token amount with proper decimals
 */
export function formatTokenAmount(
  amount: number,
  tokenType: TokenType
): string {
  const decimals = TOKEN_CONFIG[tokenType].decimals;
  return amount.toFixed(decimals);
}

/**
 * Parse token amount string to number
 */
export function parseTokenAmount(
  amountStr: string,
  tokenType: TokenType
): number {
  return parseFloat(amountStr);
}

/**
 * Convert token amount to smallest unit (tinybars for HBAR, base units for tokens)
 */
export function toSmallestUnit(
  amount: number,
  tokenType: TokenType
): bigint {
  const decimals = TOKEN_CONFIG[tokenType].decimals;
  const multiplier = Math.pow(10, decimals);
  return BigInt(Math.floor(amount * multiplier));
}

/**
 * Convert from smallest unit to token amount
 */
export function fromSmallestUnit(
  amount: bigint | number,
  tokenType: TokenType
): number {
  const decimals = TOKEN_CONFIG[tokenType].decimals;
  const divisor = Math.pow(10, decimals);
  return Number(amount) / divisor;
}

/**
 * Get token icon/emoji
 */
export function getTokenIcon(tokenType: TokenType): string {
  return TOKEN_CONFIG[tokenType].icon;
}

/**
 * Get token display name
 */
export function getTokenName(tokenType: TokenType): string {
  return TOKEN_CONFIG[tokenType].name;
}

/**
 * Check if token is a stablecoin
 */
export function isStablecoin(tokenType: TokenType): boolean {
  return TOKEN_CONFIG[tokenType].isStablecoin;
}

/**
 * Check if token is native HBAR
 */
export function isNativeToken(tokenType: TokenType): boolean {
  return TOKEN_CONFIG[tokenType].isNative;
}

/**
 * Get all supported token types
 */
export function getSupportedTokens(): TokenType[] {
  return Object.keys(TOKEN_CONFIG) as TokenType[];
}

