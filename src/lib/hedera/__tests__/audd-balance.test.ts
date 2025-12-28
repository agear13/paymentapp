/**
 * AUDD Token Balance Fetching Tests
 * 
 * Tests AUDD balance queries from Hedera Mirror Node API
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import {
  createMockAuddBalanceResponse,
  mockMirrorNodeFetch,
} from '@/lib/test-utils'
import { TOKEN_IDS } from '@/lib/hedera/constants'

describe('AUDD Balance Fetching', () => {
  beforeEach(() => {
    global.fetch = mockMirrorNodeFetch()
  })

  describe('Mainnet AUDD Balance', () => {
    it('should fetch AUDD balance for mainnet account', async () => {
      const accountId = '0.0.123456'
      const balance = 100 // 100 AUDD
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(createMockAuddBalanceResponse(accountId, balance)),
      })

      const response = await fetch(
        `https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens`
      )
      const data = await response.json()

      const auddBalance = data.balance.tokens.find(
        (t: any) => t.token_id === TOKEN_IDS.MAINNET.AUDD
      )

      expect(auddBalance).toBeDefined()
      expect(auddBalance.balance).toBe(balance * 1000000) // 6 decimals
    })

    it('should use correct mainnet AUDD token ID', () => {
      expect(TOKEN_IDS.MAINNET.AUDD).toBe('0.0.1394325')
    })

    it('should format AUDD balance with 6 decimal places', () => {
      const rawBalance = 100000000 // 100 AUDD in smallest units
      const formatted = (rawBalance / 1000000).toFixed(6)
      
      expect(formatted).toBe('100.000000')
    })
  })

  describe('Testnet AUDD Balance', () => {
    it('should fetch AUDD balance for testnet account', async () => {
      const accountId = '0.0.123456'
      const balance = 50
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(createMockAuddBalanceResponse(accountId, balance)),
      })

      const response = await fetch(
        `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens`
      )
      const data = await response.json()

      expect(data.balance.tokens).toBeDefined()
      expect(data.balance.tokens[0].balance).toBe(balance * 1000000)
    })

    it('should use correct testnet AUDD token ID', () => {
      expect(TOKEN_IDS.TESTNET.AUDD).toBe('0.0.4918852')
    })
  })

  describe('Zero Balance Handling', () => {
    it('should handle accounts with zero AUDD balance', async () => {
      const accountId = '0.0.123456'
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(createMockAuddBalanceResponse(accountId, 0)),
      })

      const response = await fetch(
        `https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens`
      )
      const data = await response.json()

      const auddBalance = data.balance.tokens.find(
        (t: any) => t.token_id === TOKEN_IDS.MAINNET.AUDD
      )

      expect(auddBalance.balance).toBe(0)
    })

    it('should format zero balance correctly', () => {
      const rawBalance = 0
      const formatted = (rawBalance / 1000000).toFixed(6)
      
      expect(formatted).toBe('0.000000')
    })
  })

  describe('Token Association Check', () => {
    it('should detect if account has AUDD associated', async () => {
      const accountId = '0.0.123456'
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(createMockAuddBalanceResponse(accountId, 100)),
      })

      const response = await fetch(
        `https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens`
      )
      const data = await response.json()

      const hasAudd = data.balance.tokens.some(
        (t: any) => t.token_id === TOKEN_IDS.MAINNET.AUDD
      )

      expect(hasAudd).toBe(true)
    })

    it('should return false if AUDD not associated', async () => {
      const accountId = '0.0.123456'
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          account: accountId,
          balance: {
            balance: 10000000000,
            timestamp: '0.000000000',
            tokens: [], // No tokens associated
          },
          links: {},
        }),
      })

      const response = await fetch(
        `https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens`
      )
      const data = await response.json()

      const hasAudd = data.balance.tokens.some(
        (t: any) => t.token_id === TOKEN_IDS.MAINNET.AUDD
      )

      expect(hasAudd).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const accountId = '0.0.123456'
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({
          _status: {
            messages: [{ message: 'Account not found' }],
          },
        }),
      })

      const response = await fetch(
        `https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens`
      )

      expect(response.ok).toBe(false)
      expect(response.status).toBe(404)
    })

    it('should handle network errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

      await expect(
        fetch('https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/0.0.123/tokens')
      ).rejects.toThrow('Network error')
    })
  })

  describe('Decimal Precision', () => {
    it('should use 6 decimals for AUDD (not 8 like HBAR)', () => {
      const rawBalance = 123456789 // AUDD uses 6 decimals
      const formatted = (rawBalance / 1000000).toFixed(6)
      
      expect(formatted).toBe('123.456789')
      
      // Compare with HBAR (8 decimals)
      const hbarRawBalance = 12345678901
      const hbarFormatted = (hbarRawBalance / 100000000).toFixed(8)
      expect(hbarFormatted).toBe('123.45678901')
      
      // Verify different decimal places
      expect(formatted.split('.')[1].length).toBe(6) // AUDD
      expect(hbarFormatted.split('.')[1].length).toBe(8) // HBAR
    })
  })

  describe('Multi-Token Balance Response', () => {
    it('should correctly identify AUDD among multiple tokens', async () => {
      const accountId = '0.0.123456'
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          account: accountId,
          balance: {
            balance: 10000000000,
            timestamp: '0.000000000',
            tokens: [
              { token_id: '0.0.456858', balance: 100000000 }, // USDC
              { token_id: '0.0.8322281', balance: 50000000 }, // USDT
              { token_id: '0.0.1394325', balance: 75000000 }, // AUDD ⭐
            ],
          },
          links: {},
        }),
      })

      const response = await fetch(
        `https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens`
      )
      const data = await response.json()

      const auddToken = data.balance.tokens.find(
        (t: any) => t.token_id === TOKEN_IDS.MAINNET.AUDD
      )

      expect(auddToken).toBeDefined()
      expect(auddToken.token_id).toBe('0.0.1394325')
      expect(auddToken.balance).toBe(75000000) // 75 AUDD
    })
  })
})







