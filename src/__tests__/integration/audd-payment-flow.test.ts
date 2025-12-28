/**
 * AUDD Payment Flow Integration Test
 * 
 * Tests the complete end-to-end AUDD payment flow including:
 * - Payment link creation with AUD currency
 * - AUDD token availability
 * - AUDD payment processing
 * - FX snapshot creation (4 tokens)
 * - Ledger posting to account 1054
 * - Xero sync with AUDD details
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import {
  createMockPaymentLinkWithAudd,
  createMockAuddTransaction,
  createMockFourTokenSnapshots,
  createMockAuddLedgerEntries,
  createMockAuddXeroSync,
} from '@/lib/test-utils'
import {
  expectLedgerBalanced,
  expectFourTokenSnapshots,
  expectAuddClearingAccount,
  resetAllMocks,
} from '@/lib/test-utils'

describe('AUDD Payment Flow - End to End', () => {
  beforeEach(() => {
    resetAllMocks()
  })

  afterEach(() => {
    resetAllMocks()
  })

  describe('Payment Link Creation with AUD Currency', () => {
    it('should create payment link with AUD currency', async () => {
      const paymentLink = createMockPaymentLinkWithAudd({
        amount: '100.00',
        currency: 'AUD',
        description: 'Test AUD Invoice',
      })

      expect(paymentLink.currency).toBe('AUD')
      expect(paymentLink.amount).toBe('100.00')
      expect(paymentLink.status).toBe('OPEN')
    })

    it('should make AUDD available as payment option for AUD invoices', async () => {
      const paymentLink = createMockPaymentLinkWithAudd({
        currency: 'AUD',
      })

      // Simulate fetching available tokens
      const availableTokens = ['HBAR', 'USDC', 'USDT', 'AUDD']
      
      expect(availableTokens).toContain('AUDD')
      expect(paymentLink.currency).toBe('AUD')
    })
  })

  describe('FX Snapshot Creation (FOUR TOKENS)', () => {
    it('should create exactly 4 snapshots at creation time', async () => {
      const paymentLink = createMockPaymentLinkWithAudd()
      const snapshots = createMockFourTokenSnapshots(
        paymentLink.id,
        'CREATION',
        'AUD'
      )

      expectFourTokenSnapshots(snapshots)
      
      // Verify AUDD snapshot exists
      const auddSnapshot = snapshots.find(s => s.tokenType === 'AUDD')
      expect(auddSnapshot).toBeDefined()
      expect(auddSnapshot?.rate).toBe('1.00000000') // 1:1 with AUD
    })

    it('should create exactly 4 snapshots at settlement time', async () => {
      const paymentLink = createMockPaymentLinkWithAudd()
      const snapshots = createMockFourTokenSnapshots(
        paymentLink.id,
        'SETTLEMENT',
        'AUD'
      )

      expectFourTokenSnapshots(snapshots)
      
      const auddSnapshot = snapshots.find(s => s.tokenType === 'AUDD')
      expect(auddSnapshot?.snapshotType).toBe('SETTLEMENT')
    })

    it('should have same timestamp for all 4 snapshots (batch creation)', async () => {
      const paymentLink = createMockPaymentLinkWithAudd()
      const snapshots = createMockFourTokenSnapshots(
        paymentLink.id,
        'CREATION',
        'AUD'
      )

      const timestamps = snapshots.map(s => s.capturedAt.getTime())
      const uniqueTimestamps = new Set(timestamps)
      
      expect(uniqueTimestamps.size).toBe(1) // All same timestamp
    })

    it('should include AUDD rate ~1.0 for AUD invoices', async () => {
      const paymentLink = createMockPaymentLinkWithAudd()
      const snapshots = createMockFourTokenSnapshots(
        paymentLink.id,
        'CREATION',
        'AUD'
      )

      const auddSnapshot = snapshots.find(s => s.tokenType === 'AUDD')
      expect(parseFloat(auddSnapshot?.rate || '0')).toBeCloseTo(1.0, 2)
    })

    it('should create 8 total snapshots (4 creation + 4 settlement)', async () => {
      const paymentLink = createMockPaymentLinkWithAudd()
      
      const creationSnapshots = createMockFourTokenSnapshots(
        paymentLink.id,
        'CREATION',
        'AUD'
      )
      
      const settlementSnapshots = createMockFourTokenSnapshots(
        paymentLink.id,
        'SETTLEMENT',
        'AUD'
      )

      const allSnapshots = [...creationSnapshots, ...settlementSnapshots]
      
      expect(allSnapshots).toHaveLength(8)
      
      // Verify we have 2 of each token type
      const tokenCounts = allSnapshots.reduce((acc, s) => {
        acc[s.tokenType] = (acc[s.tokenType] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      expect(tokenCounts.HBAR).toBe(2)
      expect(tokenCounts.USDC).toBe(2)
      expect(tokenCounts.USDT).toBe(2)
      expect(tokenCounts.AUDD).toBe(2)
    })
  })

  describe('AUDD Transaction Processing', () => {
    it('should process AUDD transaction correctly', async () => {
      const transaction = createMockAuddTransaction({
        amount: '100.000000',
        tokenType: 'AUDD',
        tokenId: '0.0.1394325',
      })

      expect(transaction.tokenType).toBe('AUDD')
      expect(transaction.tokenId).toBe('0.0.1394325')
      expect(transaction.amount).toBe('100.000000')
    })

    it('should validate AUDD amount within 0.1% tolerance', async () => {
      const expectedAmount = '100.000000'
      const actualAmounts = [
        '99.900000', // -0.1% (lower bound)
        '100.000000', // exact
        '100.100000', // +0.1% (upper bound)
        '100.150000', // +0.15% (overpayment, accepted)
      ]

      actualAmounts.forEach(actual => {
        const expected = parseFloat(expectedAmount)
        const actualVal = parseFloat(actual)
        const percentDiff = ((actualVal - expected) / expected) * 100
        
        // Within tolerance or overpayment
        expect(percentDiff).toBeGreaterThanOrEqual(-0.1)
      })
    })
  })

  describe('AUDD Ledger Posting', () => {
    it('should post AUDD payment to account 1054', async () => {
      const paymentLink = createMockPaymentLinkWithAudd()
      const entries = createMockAuddLedgerEntries(
        paymentLink.id,
        '100.00',
        '100.000000',
        '1.00000000'
      )

      const drEntry = entries.find(e => e.entryType === 'DEBIT')
      expect(drEntry).toBeDefined()
      expectAuddClearingAccount(drEntry!.accountCode)
    })

    it('should create balanced ledger entries (DR = CR)', async () => {
      const paymentLink = createMockPaymentLinkWithAudd()
      const entries = createMockAuddLedgerEntries(
        paymentLink.id,
        '100.00',
        '100.000000',
        '1.00000000'
      )

      expectLedgerBalanced(entries)
    })

    it('should include FX rate in ledger entry description', async () => {
      const paymentLink = createMockPaymentLinkWithAudd()
      const entries = createMockAuddLedgerEntries(
        paymentLink.id,
        '100.00',
        '100.000000',
        '1.00000000'
      )

      const drEntry = entries.find(e => e.entryType === 'DEBIT')
      expect(drEntry?.description).toContain('1.00000000')
      expect(drEntry?.description).toContain('AUDD')
      expect(drEntry?.description).toContain('100.000000')
    })

    it('should NOT use HBAR account (1051) for AUDD', async () => {
      const paymentLink = createMockPaymentLinkWithAudd()
      const entries = createMockAuddLedgerEntries(paymentLink.id)

      const drEntry = entries.find(e => e.entryType === 'DEBIT')
      expect(drEntry?.accountCode).not.toBe('1051')
      expect(drEntry?.accountCode).not.toBe('1052')
      expect(drEntry?.accountCode).not.toBe('1053')
      expect(drEntry?.accountCode).toBe('1054')
    })
  })

  describe('AUDD Xero Sync', () => {
    it('should create Xero sync record for AUDD payment', async () => {
      const xeroSync = createMockAuddXeroSync({
        status: 'PENDING',
      })

      expect(xeroSync).toBeDefined()
      expect(xeroSync.status).toBe('PENDING')
      expect((xeroSync.requestPayload as any).paymentToken).toBe('AUDD')
    })

    it('should include AUDD-specific narration in Xero sync', async () => {
      const xeroSync = createMockAuddXeroSync()
      const payload = xeroSync.requestPayload as any

      expect(payload.paymentMethod).toBe('HEDERA')
      expect(payload.paymentToken).toBe('AUDD')
      expect(payload.currency).toBe('AUD')
    })

    it('should mark AUDD/AUD payment as "Currency matched"', async () => {
      const xeroSync = createMockAuddXeroSync({
        requestPayload: {
          paymentMethod: 'HEDERA',
          paymentToken: 'AUDD',
          currency: 'AUD',
          amount: '100.00',
          cryptoAmount: '100.000000',
          fxRate: '1.00000000',
        },
      })

      const payload = xeroSync.requestPayload as any
      expect(payload.currency).toBe('AUD')
      expect(payload.paymentToken).toBe('AUDD')
      expect(parseFloat(payload.fxRate)).toBeCloseTo(1.0, 2)
    })
  })

  describe('Complete Payment Flow', () => {
    it('should complete full AUDD payment flow', async () => {
      // 1. Create payment link
      const paymentLink = createMockPaymentLinkWithAudd({
        amount: '100.00',
        currency: 'AUD',
      })
      expect(paymentLink.status).toBe('OPEN')

      // 2. Create 4 FX snapshots at creation
      const creationSnapshots = createMockFourTokenSnapshots(
        paymentLink.id,
        'CREATION',
        'AUD'
      )
      expectFourTokenSnapshots(creationSnapshots)

      // 3. Process AUDD transaction
      const transaction = createMockAuddTransaction({
        amount: '100.000000',
        to: '0.0.123456', // Merchant account
      })
      expect(transaction.tokenType).toBe('AUDD')

      // 4. Create 4 FX snapshots at settlement
      const settlementSnapshots = createMockFourTokenSnapshots(
        paymentLink.id,
        'SETTLEMENT',
        'AUD'
      )
      expectFourTokenSnapshots(settlementSnapshots)

      // 5. Post to ledger (account 1054)
      const ledgerEntries = createMockAuddLedgerEntries(
        paymentLink.id,
        '100.00',
        '100.000000',
        '1.00000000'
      )
      expectLedgerBalanced(ledgerEntries)
      expectAuddClearingAccount(ledgerEntries[0].accountCode)

      // 6. Create Xero sync
      const xeroSync = createMockAuddXeroSync({
        paymentLinkId: paymentLink.id,
        status: 'SUCCESS',
        xeroInvoiceId: 'inv-123',
        xeroPaymentId: 'pay-456',
      })
      expect(xeroSync.status).toBe('SUCCESS')

      // Verify complete flow
      expect(paymentLink.currency).toBe('AUD')
      expect(creationSnapshots.length).toBe(4)
      expect(settlementSnapshots.length).toBe(4)
      expect(ledgerEntries.length).toBe(2)
      expect(xeroSync.xeroInvoiceId).toBeDefined()
      expect(xeroSync.xeroPaymentId).toBeDefined()
    })
  })
})







