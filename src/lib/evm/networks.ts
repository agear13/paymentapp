/**
 * Supported EVM networks for MetaMask checkout.
 */

import { base, mainnet, polygon, type Chain } from 'viem/chains';

export type EvmNetworkId = 'ethereum' | 'base' | 'polygon';

export type EvmNetworkConfig = {
  id: EvmNetworkId;
  name: string;
  chain: Chain;
  alchemyNetwork: string;
};

export const EVM_NETWORKS: Record<EvmNetworkId, EvmNetworkConfig> = {
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    chain: mainnet,
    alchemyNetwork: 'eth-mainnet',
  },
  base: {
    id: 'base',
    name: 'Base',
    chain: base,
    alchemyNetwork: 'base-mainnet',
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon',
    chain: polygon,
    alchemyNetwork: 'polygon-mainnet',
  },
};

export const SUPPORTED_EVM_CHAIN_IDS = Object.values(EVM_NETWORKS).map((n) => n.chain.id);

export function getNetworkByChainId(chainId: number): EvmNetworkConfig | null {
  return Object.values(EVM_NETWORKS).find((n) => n.chain.id === chainId) ?? null;
}

export function normalizeNetworkId(value: string): EvmNetworkId | null {
  const normalized = value.trim().toLowerCase();
  if (normalized in EVM_NETWORKS) {
    return normalized as EvmNetworkId;
  }
  const aliases: Record<string, EvmNetworkId> = {
    eth: 'ethereum',
    'eth-mainnet': 'ethereum',
    'ethereum-mainnet': 'ethereum',
    'base-mainnet': 'base',
    'polygon-mainnet': 'polygon',
    matic: 'polygon',
  };
  return aliases[normalized] ?? null;
}

export function getAlchemyRpcUrl(networkId: EvmNetworkId, apiKey: string): string {
  const network = EVM_NETWORKS[networkId];
  return `https://${network.alchemyNetwork}.g.alchemy.com/v2/${apiKey}`;
}
