/**
 * Canonical network names — use consistently across dropdowns, placeholders, invoices, and verification.
 */

export const CANONICAL_NETWORKS = [
  'Bitcoin',
  'Ethereum',
  'Solana',
  'Polygon',
  'Arbitrum One',
  'Base',
  'BNB Chain',
  'Avalanche C-Chain',
  'Optimism',
  'Tron',
  'Hedera',
] as const;

export type CanonicalNetwork = (typeof CANONICAL_NETWORKS)[number];

const ALIASES: Record<string, CanonicalNetwork> = {
  btc: 'Bitcoin',
  bitcoin: 'Bitcoin',
  eth: 'Ethereum',
  ethereum: 'Ethereum',
  sol: 'Solana',
  solana: 'Solana',
  matic: 'Polygon',
  polygon: 'Polygon',
  arb: 'Arbitrum One',
  arbitrum: 'Arbitrum One',
  'arbitrum one': 'Arbitrum One',
  base: 'Base',
  bsc: 'BNB Chain',
  'bnb chain': 'BNB Chain',
  'bsc / bnb chain': 'BNB Chain',
  bnb: 'BNB Chain',
  avax: 'Avalanche C-Chain',
  'avalanche c-chain': 'Avalanche C-Chain',
  avalanche: 'Avalanche C-Chain',
  op: 'Optimism',
  optimism: 'Optimism',
  trx: 'Tron',
  tron: 'Tron',
  hbar: 'Hedera',
  hedera: 'Hedera',
};

export function normalizeNetworkName(input: string | null | undefined): string {
  const raw = input?.trim();
  if (!raw) return '';
  const key = raw.toLowerCase().replace(/\s+/g, ' ');
  return ALIASES[key] ?? raw;
}

/** Native and common supported assets per network family. */
const NETWORK_ASSETS: Record<string, readonly string[]> = {
  Bitcoin: ['BTC', 'BITCOIN'],
  Ethereum: ['ETH', 'ETHEREUM', 'USDC', 'USDT', 'DAI', 'WETH', 'EURC'],
  Solana: ['SOL', 'USDC', 'USDT'],
  Polygon: ['MATIC', 'POL', 'USDC', 'USDT', 'DAI'],
  'Arbitrum One': ['ETH', 'USDC', 'USDT', 'DAI', 'ARB'],
  Base: ['ETH', 'USDC', 'USDT', 'DAI'],
  'BNB Chain': ['BNB', 'USDC', 'USDT', 'BUSD'],
  'Avalanche C-Chain': ['AVAX', 'USDC', 'USDT'],
  Optimism: ['ETH', 'USDC', 'USDT', 'OP'],
  Tron: ['TRX', 'USDT', 'USDC'],
  Hedera: ['HBAR', 'USDC', 'USDT', 'AUDD', 'SAUDC'],
};

function normAsset(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, '');
}

export function isAssetSupportedOnNetwork(
  network: string | null | undefined,
  asset: string | null | undefined
): { supported: boolean; reason?: string } {
  const net = normalizeNetworkName(network);
  const ast = asset?.trim();
  if (!net || !ast) return { supported: true };

  const allowed = NETWORK_ASSETS[net];
  if (!allowed) return { supported: true };

  const normalizedAsset = normAsset(ast);
  const match = allowed.some((a) => normAsset(a) === normalizedAsset);
  if (match) return { supported: true };

  return {
    supported: false,
    reason: `Asset "${ast}" is not supported on ${net}. Expected assets include ${allowed.slice(0, 4).join(', ')}.`,
  };
}

export function networkFamily(network: string): 'evm' | 'solana' | 'bitcoin' | 'hedera' | 'tron' | 'unknown' {
  const n = normalizeNetworkName(network).toLowerCase();
  if (n === 'bitcoin') return 'bitcoin';
  if (n === 'solana') return 'solana';
  if (n === 'hedera') return 'hedera';
  if (n === 'tron') return 'tron';
  if (
    n === 'ethereum' ||
    n === 'polygon' ||
    n === 'arbitrum one' ||
    n === 'base' ||
    n === 'bnb chain' ||
    n === 'avalanche c-chain' ||
    n === 'optimism'
  ) {
    return 'evm';
  }
  return 'unknown';
}
