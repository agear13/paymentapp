/**
 * Hedera Network and Token Constants
 */

// Network Configuration
export const HEDERA_NETWORK = {
  MAINNET: 'mainnet',
  TESTNET: 'testnet',
  PREVIEWNET: 'previewnet',
} as const;

export type HederaNetwork = typeof HEDERA_NETWORK[keyof typeof HEDERA_NETWORK];

// Current Network (from environment)
export const CURRENT_NETWORK: HederaNetwork =
  (process.env.NEXT_PUBLIC_HEDERA_NETWORK as HederaNetwork) || HEDERA_NETWORK.TESTNET;

// HTS Token IDs
export const TOKEN_IDS = {
  MAINNET: {
    USDC: '0.0.456858', // USDC mainnet token ID
    USDT: '0.0.8322281', // USDT mainnet token ID (verify before production)
    AUDD: '0.0.1394325', // AUDD mainnet token ID (EVM: 0x0000000000000000000000000000000000154695)
  },
  TESTNET: {
    USDC: '0.0.429274', // USDC testnet token ID (official Hedera testnet)
    USDT: '0.0.429275', // USDT testnet token ID (official Hedera testnet)
    AUDD: '0.0.4918852', // AUDD testnet token ID (EVM: 0x00000000000000000000000000000000004b0e44)
  },
} as const;

// Token Configuration
export const TOKEN_CONFIG = {
  HBAR: {
    id: null, // HBAR doesn't have a token ID
    symbol: 'HBAR',
    name: 'Hedera Hashgraph',
    decimals: 8,
    isNative: true,
    isStablecoin: false,
    icon: '⋈', // Hedera logo placeholder
  },
  USDC: {
    id: TOKEN_IDS[CURRENT_NETWORK === 'mainnet' ? 'MAINNET' : 'TESTNET'].USDC,
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    isNative: false,
    isStablecoin: true,
    icon: '💵', // USDC logo placeholder
  },
  USDT: {
    id: TOKEN_IDS[CURRENT_NETWORK === 'mainnet' ? 'MAINNET' : 'TESTNET'].USDT,
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    isNative: false,
    isStablecoin: true,
    icon: '💲', // USDT logo placeholder
  },
  AUDD: {
    id: TOKEN_IDS[CURRENT_NETWORK === 'mainnet' ? 'MAINNET' : 'TESTNET'].AUDD,
    symbol: 'AUDD',
    name: 'Australian Digital Dollar',
    decimals: 6,
    isNative: false,
    isStablecoin: true,
    icon: '🇦🇺', // Australian flag icon
  },
} as const;

export type TokenType = keyof typeof TOKEN_CONFIG;
export type TokenConfig = typeof TOKEN_CONFIG[TokenType];

// Payment Validation Tolerances
export const PAYMENT_TOLERANCES = {
  HBAR: 0.005, // 0.5% tolerance (volatile)
  USDC: 0.001, // 0.1% tolerance (stable)
  USDT: 0.001, // 0.1% tolerance (stable)
  AUDD: 0.001, // 0.1% tolerance (stable)
} as const;

// Mirror Node URLs
export const MIRROR_NODE_URLS = {
  MAINNET: 'https://mainnet-public.mirrornode.hedera.com',
  TESTNET: 'https://testnet.mirrornode.hedera.com',
  PREVIEWNET: 'https://previewnet.mirrornode.hedera.com',
} as const;

export const CURRENT_MIRROR_URL =
  MIRROR_NODE_URLS[CURRENT_NETWORK.toUpperCase() as keyof typeof MIRROR_NODE_URLS] ||
  MIRROR_NODE_URLS.TESTNET;

// Default Node Account IDs (used for transaction submission)
export const DEFAULT_NODE_ACCOUNT_IDS = {
  MAINNET: '0.0.3', // Hedera mainnet node 0
  TESTNET: '0.0.3', // Hedera testnet node 0
  PREVIEWNET: '0.0.3', // Hedera previewnet node 0
} as const;

export const CURRENT_NODE_ACCOUNT_ID =
  DEFAULT_NODE_ACCOUNT_IDS[CURRENT_NETWORK.toUpperCase() as keyof typeof DEFAULT_NODE_ACCOUNT_IDS] ||
  DEFAULT_NODE_ACCOUNT_IDS.TESTNET;

// HashConnect Configuration
export const HASHCONNECT_CONFIG = {
  APP_METADATA: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'Provvypay',
    description: 'Provvypay Payment Link',
    url: process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'),
    icons: [
      process.env.NEXT_PUBLIC_APP_ICON || 'https://provvypay.com/icon.png',
    ],
  },
  NETWORK: CURRENT_NETWORK,
  WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
} as const;

// Transaction Polling Configuration
export const TRANSACTION_POLLING = {
  INTERVAL_MS: 5000, // Poll every 5 seconds
  MAX_ATTEMPTS: 60, // Max 5 minutes (60 * 5s)
  TIMEOUT_MS: 300000, // 5 minute timeout
} as const;

// Fee Estimates (approximate, in respective tokens)
export const ESTIMATED_FEES = {
  HBAR: 0.001, // ~$0.00003 at current rates
  USDC: 0.01, // Typically higher fee for token transfers
  USDT: 0.01, // Typically higher fee for token transfers
  AUDD: 0.01, // Typically higher fee for token transfers
} as const;

/**
 * Get token configuration for a specific token type and network
 * 
 * @param tokenType - Token type (HBAR, USDC, USDT, AUDD)
 * @param network - Network (testnet or mainnet), defaults to CURRENT_NETWORK
 * @returns Token configuration with id, decimals, and metadata
 */
export function getTokenConfig(tokenType: TokenType, network?: HederaNetwork) {
  const config = TOKEN_CONFIG[tokenType];
  const actualNetwork = network || CURRENT_NETWORK;
  
  // For HBAR, return as-is (no token ID)
  if (tokenType === 'HBAR') {
    return config;
  }
  
  // For HTS tokens, get the correct token ID for the network
  const networkKey = actualNetwork === 'mainnet' ? 'MAINNET' : 'TESTNET';
  const tokenId = TOKEN_IDS[networkKey][tokenType as 'USDC' | 'USDT' | 'AUDD'];
  
  return {
    ...config,
    id: tokenId,
  };
}

