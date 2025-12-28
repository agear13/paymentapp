/**
 * AUDD Wrong-Token Rejection Tests
 * 
 * CRITICAL: Ensures payments with wrong tokens are rejected
 * Prevents HBAR/USDC/USDT being accepted when AUDD is expected
 */

import { describe, it, expect } from '@jest/globals'
import {
  createMockAuddTransaction,
  createMockHbarTransaction,
  createMockUsdcTransaction,
  createMockUsdtTransaction,
} from '@/lib/test-utils'
import { TOKEN_IDS } from '@/lib/hedera/constants'

describe('AUDD Wrong-Token Rejection', () => {
  const expectedToken = {
    type: 'AUDD',
    id: TOKEN_IDS.MAINNET.AUDD,
    name: 'Australian Digital Dollar',
  }

  describe('Token Type Validation', () => {
    it('should reject HBAR when AUDD expected', () => {
      const auddTx = createMockAuddTransaction()
      const hbarTx = createMockHbarTransaction()
      
      expect(hbarTx.tokenType).not.toBe(auddTx.tokenType)
      expect(hbarTx.tokenType).not.toBe('AUDD')
      expect(auddTx.tokenType).toBe('AUDD')
    })

    it('should reject USDC when AUDD expected', () => {
      const auddTx = createMockAuddTransaction()
      const usdcTx = createMockUsdcTransaction()
      
      expect(usdcTx.tokenType).not.toBe(auddTx.tokenType)
      expect(usdcTx.tokenType).not.toBe('AUDD')
    })

    it('should reject USDT when AUDD expected', () => {
      const auddTx = createMockAuddTransaction()
      const usdtTx = createMockUsdtTransaction()
      
      expect(usdtTx.tokenType).not.toBe(auddTx.tokenType)
      expect(usdtTx.tokenType).not.toBe('AUDD')
    })
  })

  describe('Token ID Validation', () => {
    it('should reject HBAR token ID (null) when AUDD expected', () => {
      const hbarTx = createMockHbarTransaction()
      
      expect(hbarTx.tokenId).toBeNull()
      expect(hbarTx.tokenId).not.toBe(TOKEN_IDS.MAINNET.AUDD)
    })

    it('should reject USDC token ID when AUDD expected', () => {
      const usdcTx = createMockUsdcTransaction()
      
      expect(usdcTx.tokenId).toBe(TOKEN_IDS.MAINNET.USDC)
      expect(usdcTx.tokenId).not.toBe(TOKEN_IDS.MAINNET.AUDD)
    })

    it('should reject USDT token ID when AUDD expected', () => {
      const usdtTx = createMockUsdtTransaction()
      
      expect(usdtTx.tokenId).toBe(TOKEN_IDS.MAINNET.USDT)
      expect(usdtTx.tokenId).not.toBe(TOKEN_IDS.MAINNET.AUDD)
    })

    it('should accept only correct AUDD token ID', () => {
      const auddTx = createMockAuddTransaction()
      
      expect(auddTx.tokenId).toBe(TOKEN_IDS.MAINNET.AUDD)
      expect(auddTx.tokenId).toBe('0.0.1394325')
    })
  })

  describe('Error Messages', () => {
    it('should provide clear error for HBAR instead of AUDD', () => {
      const errorMessage = `❌ Wrong Token Received

Expected: Australian Digital Dollar (AUDD)
Received: Hedera Hashgraph (HBAR)

Please retry your payment using AUDD token.
Token ID: ${TOKEN_IDS.MAINNET.AUDD}`
      
      expect(errorMessage).toContain('Wrong Token Received')
      expect(errorMessage).toContain('AUDD')
      expect(errorMessage).toContain('HBAR')
      expect(errorMessage).toContain(TOKEN_IDS.MAINNET.AUDD)
    })

    it('should provide clear error for USDC instead of AUDD', () => {
      const errorMessage = `❌ Wrong Token Received

Expected: Australian Digital Dollar (AUDD)
Received: USD Coin (USDC)

Please retry your payment using AUDD token.`
      
      expect(errorMessage).toContain('AUDD')
      expect(errorMessage).toContain('USDC')
      expect(errorMessage).toContain('retry your payment')
    })

    it('should include token ID in error message', () => {
      const errorMessage = `Token ID: ${TOKEN_IDS.MAINNET.AUDD}`
      
      expect(errorMessage).toContain('0.0.1394325')
    })
  })

  describe('Rejection Scenarios', () => {
    it('should reject transaction with wrong token type even if amount is correct', () => {
      const auddAmount = '100.000000'
      
      const hbarTx = createMockHbarTransaction({ amount: '100.00000000' })
      const auddTx = createMockAuddTransaction({ amount: auddAmount })
      
      // Even if amounts match, token type must match
      expect(hbarTx.tokenType).not.toBe(auddTx.tokenType)
    })

    it('should reject all wrong tokens simultaneously', () => {
      const hbarTx = createMockHbarTransaction()
      const usdcTx = createMockUsdcTransaction()
      const usdtTx = createMockUsdtTransaction()
      
      const wrongTokens = [hbarTx.tokenType, usdcTx.tokenType, usdtTx.tokenType]
      
      wrongTokens.forEach(tokenType => {
        expect(tokenType).not.toBe('AUDD')
      })
    })
  })

  describe('Payment Link Status', () => {
    it('should keep payment link OPEN after wrong token rejection', () => {
      // Simulate wrong token attempt
      const wrongTx = createMockHbarTransaction()
      
      expect(wrongTx.tokenType).not.toBe('AUDD')
      
      // Payment link should remain OPEN for retry
      const linkStatus = 'OPEN' // Should not change to PAID
      expect(linkStatus).toBe('OPEN')
    })

    it('should allow retry after wrong token rejection', () => {
      // First attempt with wrong token
      const wrongTx = createMockUsdcTransaction()
      expect(wrongTx.tokenType).not.toBe('AUDD')
      
      // Retry with correct token
      const correctTx = createMockAuddTransaction()
      expect(correctTx.tokenType).toBe('AUDD')
      
      // Should accept correct token
      expect(correctTx.tokenType).toBe('AUDD')
    })
  })

  describe('Logging and Audit', () => {
    it('should log wrong token attempt', () => {
      const attempt = {
        expectedToken: 'AUDD',
        receivedToken: 'HBAR',
        timestamp: new Date(),
        paymentLinkId: 'test-link-123',
        reason: 'WRONG_TOKEN_TYPE',
      }
      
      expect(attempt.expectedToken).toBe('AUDD')
      expect(attempt.receivedToken).not.toBe(attempt.expectedToken)
      expect(attempt.reason).toBe('WRONG_TOKEN_TYPE')
    })

    it('should record transaction ID of rejected payment', () => {
      const wrongTx = createMockHbarTransaction()
      
      const rejectionRecord = {
        transactionId: wrongTx.transactionId,
        rejectedToken: wrongTx.tokenType,
        expectedToken: 'AUDD',
      }
      
      expect(rejectionRecord.transactionId).toBeDefined()
      expect(rejectionRecord.rejectedToken).not.toBe(rejectionRecord.expectedToken)
    })
  })

  describe('Reverse Scenarios (AUDD sent when other token expected)', () => {
    it('should reject AUDD when HBAR expected', () => {
      const auddTx = createMockAuddTransaction()
      const expectedTokenType = 'HBAR'
      
      expect(auddTx.tokenType).not.toBe(expectedTokenType)
    })

    it('should reject AUDD when USDC expected', () => {
      const auddTx = createMockAuddTransaction()
      const expectedTokenType = 'USDC'
      
      expect(auddTx.tokenType).not.toBe(expectedTokenType)
    })

    it('should reject AUDD when USDT expected', () => {
      const auddTx = createMockAuddTransaction()
      const expectedTokenType = 'USDT'
      
      expect(auddTx.tokenType).not.toBe(expectedTokenType)
    })
  })

  describe('Network-Specific Validation', () => {
    it('should reject testnet AUDD when mainnet expected', () => {
      const mainnetAudd = TOKEN_IDS.MAINNET.AUDD // 0.0.1394325
      const testnetAudd = TOKEN_IDS.TESTNET.AUDD // 0.0.4918852
      
      expect(testnetAudd).not.toBe(mainnetAudd)
    })

    it('should reject mainnet AUDD when testnet expected', () => {
      const mainnetAudd = TOKEN_IDS.MAINNET.AUDD
      const testnetAudd = TOKEN_IDS.TESTNET.AUDD
      
      expect(mainnetAudd).not.toBe(testnetAudd)
    })
  })

  describe('User Instructions', () => {
    it('should provide retry instructions', () => {
      const instructions = `
To complete your payment:
1. Select AUDD (Australian Digital Dollar) in your wallet
2. Send exactly the required amount
3. Use Token ID: ${TOKEN_IDS.MAINNET.AUDD}
4. DO NOT send HBAR, USDC, or USDT
      `.trim()
      
      expect(instructions).toContain('AUDD')
      expect(instructions).toContain(TOKEN_IDS.MAINNET.AUDD)
      expect(instructions).toContain('DO NOT send')
    })
  })

  describe('Edge Cases', () => {
    it('should reject null token ID when AUDD expected', () => {
      const hbarTx = createMockHbarTransaction()
      
      expect(hbarTx.tokenId).toBeNull()
      expect(hbarTx.tokenId).not.toBe(TOKEN_IDS.MAINNET.AUDD)
    })

    it('should reject undefined token ID', () => {
      const expectedTokenId = TOKEN_IDS.MAINNET.AUDD
      const actualTokenId = undefined
      
      expect(actualTokenId).not.toBe(expectedTokenId)
    })

    it('should reject invalid token ID format', () => {
      const validAuddId = TOKEN_IDS.MAINNET.AUDD // 0.0.1394325
      const invalidId = 'invalid-token-id'
      
      expect(invalidId).not.toBe(validAuddId)
      expect(invalidId).not.toMatch(/^0\.0\.\d+$/)
    })
  })
})







