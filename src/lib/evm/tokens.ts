/**
 * ERC-20 token configuration per EVM network.
 */

import type { EvmNetworkId } from '@/lib/evm/networks';

export type EvmSettlementToken = 'USDC' | 'USDT';

export type EvmTokenConfig = {
  symbol: EvmSettlementToken;
  decimals: number;
  addresses: Record<EvmNetworkId, `0x${string}`>;
};

export const EVM_TOKENS: Record<EvmSettlementToken, EvmTokenConfig> = {
  USDC: {
    symbol: 'USDC',
    decimals: 6,
    addresses: {
      ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      base: '0x833589fCD6edb6E08f4c7C32D4f71b54bdA02913',
      polygon: '0x3c499c542cEF5E3811e1192dce6d286ef767670',
    },
  },
  USDT: {
    symbol: 'USDT',
    decimals: 6,
    addresses: {
      ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      base: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
      polygon: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    },
  },
};

export const EVM_SETTLEMENT_TOKENS: EvmSettlementToken[] = ['USDC', 'USDT'];

export function getTokenAddress(
  token: EvmSettlementToken,
  networkId: EvmNetworkId
): `0x${string}` {
  return EVM_TOKENS[token].addresses[networkId];
}

export function resolveTokenFromContractAddress(
  contractAddress: string,
  networkId: EvmNetworkId
): EvmSettlementToken | null {
  const normalized = contractAddress.trim().toLowerCase();
  for (const token of EVM_SETTLEMENT_TOKENS) {
    if (EVM_TOKENS[token].addresses[networkId].toLowerCase() === normalized) {
      return token;
    }
  }
  return null;
}
