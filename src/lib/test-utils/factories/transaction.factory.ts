/**
 * Hedera Transaction Test Factory
 */

import type { TokenType } from '@/lib/hedera/constants'

export interface MockHederaTransaction {
  transactionId: string
  amount: string
  tokenType: TokenType
  tokenId: string | null
  timestamp: Date
  from: string
  to: string
  memo?: string
  status: 'SUCCESS' | 'PENDING' | 'FAILED'
}

export function createMockHederaTransaction(
  overrides?: Partial<MockHederaTransaction>
): MockHederaTransaction {
  const timestamp = overrides?.timestamp || new Date()
  const timestampNanos = Math.floor(timestamp.getTime() * 1000000)
  
  return {
    transactionId: overrides?.transactionId || `0.0.123@${timestampNanos}.000000000`,
    amount: overrides?.amount || '100.000000',
    tokenType: overrides?.tokenType || 'USDC',
    tokenId: overrides?.tokenId || '0.0.456858',
    timestamp,
    from: overrides?.from || '0.0.999888',
    to: overrides?.to || '0.0.123456',
    memo: overrides?.memo,
    status: overrides?.status || 'SUCCESS',
  }
}

export function createMockAuddTransaction(
  overrides?: Partial<MockHederaTransaction>
): MockHederaTransaction {
  return createMockHederaTransaction({
    tokenType: 'AUDD',
    tokenId: '0.0.1394325', // Mainnet AUDD token ID
    amount: '100.000000', // 6 decimals for AUDD
    ...overrides,
  })
}

export function createMockAuddTransactionTestnet(
  overrides?: Partial<MockHederaTransaction>
): MockHederaTransaction {
  return createMockHederaTransaction({
    tokenType: 'AUDD',
    tokenId: '0.0.4918852', // Testnet AUDD token ID
    amount: '100.000000',
    ...overrides,
  })
}

export function createMockHbarTransaction(
  overrides?: Partial<MockHederaTransaction>
): MockHederaTransaction {
  return createMockHederaTransaction({
    tokenType: 'HBAR',
    tokenId: null, // HBAR is native, no token ID
    amount: '1234.56789012', // 8 decimals for HBAR
    ...overrides,
  })
}

export function createMockUsdcTransaction(
  overrides?: Partial<MockHederaTransaction>
): MockHederaTransaction {
  return createMockHederaTransaction({
    tokenType: 'USDC',
    tokenId: '0.0.456858',
    amount: '100.000000',
    ...overrides,
  })
}

export function createMockUsdtTransaction(
  overrides?: Partial<MockHederaTransaction>
): MockHederaTransaction {
  return createMockHederaTransaction({
    tokenType: 'USDT',
    tokenId: '0.0.8322281',
    amount: '100.000000',
    ...overrides,
  })
}







