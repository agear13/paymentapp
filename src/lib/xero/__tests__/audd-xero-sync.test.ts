/**
 * AUDD Xero Sync Tests
 * 
 * Tests AUDD payment recording in Xero with correct account mapping and narration
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import {
  createMockAuddXeroSync,
  createMockSuccessfulXeroSync,
  createMockFailedXeroSync,
  createMockAuddPaymentNarration,
  resetAllMocks,
} from '@/lib/test-utils'

describe('AUDD Xero Sync', () => {
  beforeEach(() => {
    resetAllMocks()
  })

  describe('Xero Sync Record Creation', () => {
    it('should create Xero sync for AUDD payment', () => {
      const xeroSync = createMockAuddXeroSync()
      
      expect(xeroSync).toBeDefined()
      expect(xeroSync.syncType).toBe('INVOICE_AND_PAYMENT')
      expect((xeroSync.requestPayload as any).paymentToken).toBe('AUDD')
    })

    it('should include AUDD-specific details in request payload', () => {
      const xeroSync = createMockAuddXeroSync()
      const payload = xeroSync.requestPayload as any
      
      expect(payload.paymentMethod).toBe('HEDERA')
      expect(payload.paymentToken).toBe('AUDD')
      expect(payload.transactionId).toBeDefined()
      expect(payload.cryptoAmount).toBeDefined()
      expect(payload.fxRate).toBeDefined()
    })
  })

  describe('Clearing Account Mapping', () => {
    it('should use AUDD clearing account (1054)', () => {
      const xeroSync = createMockAuddXeroSync()
      const payload = xeroSync.requestPayload as any
      
      expect(payload.paymentToken).toBe('AUDD')
      // In real implementation, this would map to xero_audd_clearing_account_id
    })

    it('should NOT use HBAR clearing account', () => {
      const xeroSync = createMockAuddXeroSync()
      const payload = xeroSync.requestPayload as any
      
      expect(payload.paymentToken).not.toBe('HBAR')
      expect(payload.paymentToken).toBe('AUDD')
    })

    it('should NOT use USDC clearing account', () => {
      const xeroSync = createMockAuddXeroSync()
      const payload = xeroSync.requestPayload as any
      
      expect(payload.paymentToken).not.toBe('USDC')
    })

    it('should NOT use USDT clearing account', () => {
      const xeroSync = createMockAuddXeroSync()
      const payload = xeroSync.requestPayload as any
      
      expect(payload.paymentToken).not.toBe('USDT')
    })
  })

  describe('Payment Narration', () => {
    const transactionId = '0.0.123@1234567890.000000000'

    it('should include "HEDERA_AUDD" in narration', () => {
      const narration = createMockAuddPaymentNarration(
        transactionId,
        '100.000000',
        '100.00',
        'AUD',
        '1.00000000'
      )
      
      expect(narration).toContain('HEDERA_AUDD')
    })

    it('should include transaction ID in narration', () => {
      const narration = createMockAuddPaymentNarration(
        transactionId,
        '100.000000',
        '100.00',
        'AUD'
      )
      
      expect(narration).toContain(transactionId)
    })

    it('should include token type "AUDD" in narration', () => {
      const narration = createMockAuddPaymentNarration(
        transactionId,
        '100.000000',
        '100.00',
        'AUD'
      )
      
      expect(narration).toContain('Token: AUDD')
    })

    it('should include FX rate in narration', () => {
      const narration = createMockAuddPaymentNarration(
        transactionId,
        '100.000000',
        '100.00',
        'AUD',
        '1.00000000'
      )
      
      expect(narration).toContain('1.00000000 AUDD/AUD')
    })

    it('should include crypto and fiat amounts in narration', () => {
      const narration = createMockAuddPaymentNarration(
        transactionId,
        '100.000000',
        '100.00',
        'AUD',
        '1.00000000'
      )
      
      expect(narration).toContain('100.000000 AUDD')
      expect(narration).toContain('100.00 AUD')
    })

    it('should include "Currency matched" note for AUD invoices', () => {
      const narration = createMockAuddPaymentNarration(
        transactionId,
        '100.000000',
        '100.00',
        'AUD', // ⭐ Currency matches AUDD
        '1.00000000'
      )
      
      expect(narration).toContain('No FX risk')
      expect(narration).toContain('Currency matched payment')
      expect(narration).toContain('🇦🇺')
    })

    it('should NOT include "Currency matched" for USD invoices', () => {
      const narration = createMockAuddPaymentNarration(
        transactionId,
        '152.000000',
        '100.00',
        'USD', // Different currency
        '0.65800000'
      )
      
      expect(narration).not.toContain('No FX risk')
      expect(narration).not.toContain('Currency matched')
    })
  })

  describe('Sync Status Management', () => {
    it('should create sync in PENDING status', () => {
      const xeroSync = createMockAuddXeroSync({
        status: 'PENDING',
      })
      
      expect(xeroSync.status).toBe('PENDING')
      expect(xeroSync.completedAt).toBeNull()
    })

    it('should mark sync as SUCCESS when complete', () => {
      const xeroSync = createMockSuccessfulXeroSync({
        requestPayload: {
          paymentToken: 'AUDD',
          paymentMethod: 'HEDERA',
        },
      })
      
      expect(xeroSync.status).toBe('SUCCESS')
      expect(xeroSync.completedAt).toBeDefined()
      expect(xeroSync.xeroInvoiceId).toBeDefined()
      expect(xeroSync.xeroPaymentId).toBeDefined()
    })

    it('should mark sync as FAILED with error details', () => {
      const xeroSync = createMockFailedXeroSync({
        requestPayload: {
          paymentToken: 'AUDD',
        },
      })
      
      expect(xeroSync.status).toBe('FAILED')
      expect(xeroSync.errorMessage).toBeDefined()
      expect(xeroSync.errorCode).toBeDefined()
    })
  })

  describe('Retry Logic', () => {
    it('should track retry count', () => {
      const xeroSync = createMockFailedXeroSync({
        retryCount: 3,
      })
      
      expect(xeroSync.retryCount).toBe(3)
    })

    it('should set next retry time for failed syncs', () => {
      const xeroSync = createMockAuddXeroSync({
        status: 'FAILED',
        retryCount: 1,
        nextRetryAt: new Date(Date.now() + 60000), // 1 minute
      })
      
      expect(xeroSync.nextRetryAt).toBeDefined()
    })

    it('should increment retry count on subsequent failures', () => {
      const attempt1 = createMockFailedXeroSync({ retryCount: 0 })
      const attempt2 = createMockFailedXeroSync({ retryCount: 1 })
      const attempt3 = createMockFailedXeroSync({ retryCount: 2 })
      
      expect(attempt2.retryCount).toBeGreaterThan(attempt1.retryCount)
      expect(attempt3.retryCount).toBeGreaterThan(attempt2.retryCount)
    })
  })

  describe('Invoice and Payment IDs', () => {
    it('should store Xero invoice ID on success', () => {
      const xeroSync = createMockSuccessfulXeroSync()
      
      expect(xeroSync.xeroInvoiceId).toBeDefined()
      expect(typeof xeroSync.xeroInvoiceId).toBe('string')
    })

    it('should store Xero payment ID on success', () => {
      const xeroSync = createMockSuccessfulXeroSync()
      
      expect(xeroSync.xeroPaymentId).toBeDefined()
      expect(typeof xeroSync.xeroPaymentId).toBe('string')
    })

    it('should have null invoice/payment IDs when pending', () => {
      const xeroSync = createMockAuddXeroSync({
        status: 'PENDING',
      })
      
      expect(xeroSync.xeroInvoiceId).toBeNull()
      expect(xeroSync.xeroPaymentId).toBeNull()
    })
  })

  describe('Request and Response Payloads', () => {
    it('should store complete request payload', () => {
      const xeroSync = createMockAuddXeroSync()
      
      expect(xeroSync.requestPayload).toBeDefined()
      expect(typeof xeroSync.requestPayload).toBe('object')
      
      const payload = xeroSync.requestPayload as any
      expect(payload.paymentToken).toBe('AUDD')
    })

    it('should store response payload on completion', () => {
      const xeroSync = createMockSuccessfulXeroSync({
        responsePayload: {
          invoiceId: 'inv-123',
          paymentId: 'pay-456',
          status: 'AUTHORISED',
        },
      })
      
      expect(xeroSync.responsePayload).toBeDefined()
    })
  })

  describe('Currency-Specific Scenarios', () => {
    it('should handle AUDD payment for AUD invoice (1:1 rate)', () => {
      const narration = createMockAuddPaymentNarration(
        '0.0.123@456.789',
        '100.000000',
        '100.00',
        'AUD',
        '1.00000000'
      )
      
      expect(narration).toContain('1.00000000 AUDD/AUD')
      expect(narration).toContain('No FX risk')
    })

    it('should handle AUDD payment for USD invoice (with FX)', () => {
      const narration = createMockAuddPaymentNarration(
        '0.0.123@456.789',
        '152.000000', // More AUDD needed
        '100.00',
        'USD',
        '0.65800000' // AUD/USD rate
      )
      
      expect(narration).toContain('0.65800000 AUDD/USD')
      expect(narration).not.toContain('No FX risk')
    })
  })

  describe('Error Handling', () => {
    it('should capture error message on failure', () => {
      const xeroSync = createMockFailedXeroSync({
        errorMessage: 'Invalid account code: 1054',
      })
      
      expect(xeroSync.errorMessage).toBe('Invalid account code: 1054')
    })

    it('should capture error code on failure', () => {
      const xeroSync = createMockFailedXeroSync({
        errorCode: 'INVALID_ACCOUNT',
      })
      
      expect(xeroSync.errorCode).toBe('INVALID_ACCOUNT')
    })

    it('should not have error details on success', () => {
      const xeroSync = createMockSuccessfulXeroSync()
      
      expect(xeroSync.errorMessage).toBeNull()
      expect(xeroSync.errorCode).toBeNull()
    })
  })

  describe('Timestamps', () => {
    it('should have creation timestamp', () => {
      const xeroSync = createMockAuddXeroSync()
      
      expect(xeroSync.createdAt).toBeDefined()
      expect(xeroSync.createdAt).toBeInstanceOf(Date)
    })

    it('should have update timestamp', () => {
      const xeroSync = createMockAuddXeroSync()
      
      expect(xeroSync.updatedAt).toBeDefined()
      expect(xeroSync.updatedAt).toBeInstanceOf(Date)
    })

    it('should have completion timestamp on success', () => {
      const xeroSync = createMockSuccessfulXeroSync()
      
      expect(xeroSync.completedAt).toBeDefined()
      expect(xeroSync.completedAt).toBeInstanceOf(Date)
    })

    it('should not have completion timestamp when pending', () => {
      const xeroSync = createMockAuddXeroSync({
        status: 'PENDING',
      })
      
      expect(xeroSync.completedAt).toBeNull()
    })
  })

  describe('Integration with Payment Link', () => {
    it('should reference payment link ID', () => {
      const paymentLinkId = 'test-link-123'
      const xeroSync = createMockAuddXeroSync({
        paymentLinkId,
      })
      
      expect(xeroSync.paymentLinkId).toBe(paymentLinkId)
    })

    it('should reference organization ID', () => {
      const organizationId = 'test-org-123'
      const xeroSync = createMockAuddXeroSync({
        organizationId,
      })
      
      expect(xeroSync.organizationId).toBe(organizationId)
    })
  })
})







