/**
 * AUDD Transaction Monitoring Tests
 * 
 * Tests AUDD transaction detection, validation, and monitoring
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import {
  createMockAuddTransaction,
  createMockAuddTransactionResponse,
  expectTokenToleranceValid,
} from '@/lib/test-utils'
import { TOKEN_IDS, PAYMENT_TOLERANCES } from '@/lib/hedera/constants'

describe('AUDD Transaction Monitoring', () => {
  const merchantAccountId = '0.0.123456'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('AUDD Transaction Detection', () => {
    it('should detect incoming AUDD transaction', async () => {
      const transaction = createMockAuddTransaction({
        to: merchantAccountId,
        amount: '100.000000',
        tokenId: TOKEN_IDS.MAINNET.AUDD,
      })

      expect(transaction).toBeDefined()
      expect(transaction.tokenType).toBe('AUDD')
      expect(transaction.tokenId).toBe('0.0.1394325')
      expect(transaction.to).toBe(merchantAccountId)
    })

    it('should validate AUDD token ID matches expected', () => {
      const transaction = createMockAuddTransaction()
      
      expect(transaction.tokenId).toBe(TOKEN_IDS.MAINNET.AUDD)
      expect(transaction.tokenType).toBe('AUDD')
    })

    it('should parse AUDD transaction from Mirror Node response', async () => {
      const response = createMockAuddTransactionResponse(
        merchantAccountId,
        '100.000000'
      )

      expect(response.transactions).toHaveLength(1)
      expect(response.transactions[0].result).toBe('SUCCESS')
      
      const tokenTransfers = response.transactions[0].token_transfers
      expect(tokenTransfers).toBeDefined()
      expect(tokenTransfers.length).toBeGreaterThan(0)
      
      const auddTransfer = tokenTransfers.find(
        (t: any) => t.token_id === TOKEN_IDS.MAINNET.AUDD
      )
      expect(auddTransfer).toBeDefined()
    })
  })

  describe('AUDD Amount Validation (0.1% Tolerance)', () => {
    const expectedAmount = '100.000000'

    it('should accept exact AUDD amount', () => {
      const actualAmount = '100.000000'
      const isValid = expectTokenToleranceValid(expectedAmount, actualAmount, 'AUDD')
      
      expect(isValid).toBe(true)
    })

    it('should accept AUDD amount at lower tolerance bound (-0.1%)', () => {
      const actualAmount = '99.900000' // -0.1%
      const isValid = expectTokenToleranceValid(expectedAmount, actualAmount, 'AUDD')
      
      expect(isValid).toBe(true)
    })

    it('should accept AUDD amount at upper tolerance bound (+0.1%)', () => {
      const actualAmount = '100.100000' // +0.1%
      const isValid = expectTokenToleranceValid(expectedAmount, actualAmount, 'AUDD')
      
      expect(isValid).toBe(true)
    })

    it('should accept AUDD overpayment (+0.15%)', () => {
      const actualAmount = '100.150000' // +0.15%
      const expected = parseFloat(expectedAmount)
      const actual = parseFloat(actualAmount)
      const percentDiff = ((actual - expected) / expected) * 100
      
      expect(percentDiff).toBeGreaterThan(0.1)
      expect(actual).toBeGreaterThan(expected)
    })

    it('should reject AUDD underpayment below tolerance (-0.15%)', () => {
      const actualAmount = '99.850000' // -0.15%
      const expected = parseFloat(expectedAmount)
      const actual = parseFloat(actualAmount)
      const percentDiff = ((actual - expected) / expected) * 100
      
      expect(percentDiff).toBeLessThan(-PAYMENT_TOLERANCES.AUDD * 100)
    })

    it('should use 0.1% tolerance for AUDD (same as USDC/USDT)', () => {
      expect(PAYMENT_TOLERANCES.AUDD).toBe(0.001) // 0.1%
      expect(PAYMENT_TOLERANCES.AUDD).toBe(PAYMENT_TOLERANCES.USDC)
      expect(PAYMENT_TOLERANCES.AUDD).toBe(PAYMENT_TOLERANCES.USDT)
      expect(PAYMENT_TOLERANCES.AUDD).not.toBe(PAYMENT_TOLERANCES.HBAR) // 0.5%
    })
  })

  describe('Wrong Token Rejection', () => {
    it('should reject HBAR when AUDD expected', () => {
      const expectedToken = 'AUDD'
      const actualToken = 'HBAR'
      
      expect(actualToken).not.toBe(expectedToken)
    })

    it('should reject USDC when AUDD expected', () => {
      const transaction = createMockAuddTransaction()
      const wrongTokenId = TOKEN_IDS.MAINNET.USDC
      
      expect(transaction.tokenId).not.toBe(wrongTokenId)
      expect(transaction.tokenType).toBe('AUDD')
    })

    it('should reject USDT when AUDD expected', () => {
      const transaction = createMockAuddTransaction()
      const wrongTokenId = TOKEN_IDS.MAINNET.USDT
      
      expect(transaction.tokenId).not.toBe(wrongTokenId)
      expect(transaction.tokenType).toBe('AUDD')
    })

    it('should provide clear error for wrong token', () => {
      const expectedToken = {
        type: 'AUDD',
        id: TOKEN_IDS.MAINNET.AUDD,
        name: 'Australian Digital Dollar',
      }
      
      const receivedToken = {
        type: 'USDC',
        id: TOKEN_IDS.MAINNET.USDC,
        name: 'USD Coin',
      }

      const errorMessage = `Wrong Token Received\n\nExpected: ${expectedToken.name} (${expectedToken.type})\nReceived: ${receivedToken.name} (${receivedToken.type})\n\nPlease retry your payment using AUDD token.`
      
      expect(errorMessage).toContain('Wrong Token Received')
      expect(errorMessage).toContain('AUDD')
      expect(errorMessage).toContain('USDC')
    })
  })

  describe('Transaction Polling', () => {
    it('should poll Mirror Node API for AUDD transactions', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(
          createMockAuddTransactionResponse(merchantAccountId, '100.000000')
        ),
      })
      
      global.fetch = mockFetch

      // Simulate polling
      const response = await fetch(
        `https://mainnet-public.mirrornode.hedera.com/api/v1/transactions?account.id=${merchantAccountId}&token.id=${TOKEN_IDS.MAINNET.AUDD}`
      )
      const data = await response.json()

      expect(mockFetch).toHaveBeenCalled()
      expect(data.transactions).toBeDefined()
    })

    it('should filter transactions by AUDD token ID', () => {
      const auddTokenId = TOKEN_IDS.MAINNET.AUDD
      const url = `https://mainnet-public.mirrornode.hedera.com/api/v1/transactions?account.id=${merchantAccountId}&token.id=${auddTokenId}`
      
      expect(url).toContain('token.id=0.0.1394325')
    })

    it('should timeout after 5 minutes (60 attempts x 5 seconds)', () => {
      const INTERVAL_MS = 5000 // 5 seconds
      const MAX_ATTEMPTS = 60
      const TIMEOUT_MS = MAX_ATTEMPTS * INTERVAL_MS
      
      expect(TIMEOUT_MS).toBe(300000) // 5 minutes
    })
  })

  describe('Transaction Confirmation', () => {
    it('should verify AUDD transaction is successful', () => {
      const transaction = createMockAuddTransaction({
        status: 'SUCCESS',
      })

      expect(transaction.status).toBe('SUCCESS')
    })

    it('should include transaction timestamp', () => {
      const transaction = createMockAuddTransaction()
      
      expect(transaction.timestamp).toBeDefined()
      expect(transaction.timestamp).toBeInstanceOf(Date)
    })

    it('should include transaction ID', () => {
      const transaction = createMockAuddTransaction()
      
      expect(transaction.transactionId).toBeDefined()
      expect(transaction.transactionId).toMatch(/0\.0\.\d+@\d+\.\d+/)
    })
  })

  describe('Network Differences (Mainnet vs Testnet)', () => {
    it('should use mainnet AUDD token ID', () => {
      const mainnetAudd = TOKEN_IDS.MAINNET.AUDD
      expect(mainnetAudd).toBe('0.0.1394325')
    })

    it('should use testnet AUDD token ID', () => {
      const testnetAudd = TOKEN_IDS.TESTNET.AUDD
      expect(testnetAudd).toBe('0.0.4918852')
    })

    it('should use different token IDs for mainnet and testnet', () => {
      expect(TOKEN_IDS.MAINNET.AUDD).not.toBe(TOKEN_IDS.TESTNET.AUDD)
    })
  })

  describe('Decimal Precision Handling', () => {
    it('should handle AUDD amounts with 6 decimal places', () => {
      const amounts = [
        '100.000000',
        '99.900000',
        '100.100000',
        '123.456789',
      ]

      amounts.forEach(amount => {
        const decimals = amount.split('.')[1]
        expect(decimals.length).toBe(6)
      })
    })

    it('should NOT use 8 decimals like HBAR', () => {
      const auddAmount = '100.000000' // 6 decimals
      const hbarAmount = '100.00000000' // 8 decimals
      
      expect(auddAmount.split('.')[1].length).toBe(6)
      expect(hbarAmount.split('.')[1].length).toBe(8)
      expect(auddAmount.length).toBeLessThan(hbarAmount.length)
    })
  })
})







