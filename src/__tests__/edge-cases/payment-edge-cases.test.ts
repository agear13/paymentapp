/**
 * Payment Edge Cases Test Suite
 * 
 * Tests for Sprint 24 edge case handling:
 * - Underpayment handling
 * - Overpayment handling
 * - Duplicate payment detection
 * - Race conditions
 * - Expired link payments
 */

import {
  handleUnderpayment,
  handleOverpayment,
  checkDuplicatePayment,
  validatePaymentAttempt,
  acquirePaymentLock,
  releasePaymentLock,
  handleExpiredLinkPayment,
} from '@/lib/payment/edge-case-handler';
import { prisma } from '@/lib/db';

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    payment_events: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    payment_links: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

describe('Payment Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================================================
  // Underpayment Handling
  // ========================================================================

  describe('handleUnderpayment', () => {
    it('should detect small underpayment (<1%) and suggest manual review', async () => {
      const mockCreate = prisma.payment_events.create as jest.Mock;
      mockCreate.mockResolvedValue({});

      const result = await handleUnderpayment(
        'link-123',
        100,
        99.5,
        'HBAR'
      );

      expect(result.shortfall).toBeCloseTo(0.5);
      expect(result.shortfallPercent).toBeCloseTo(0.5);
      expect(result.suggestedAction).toBe('manual_review');
      expect(result.canRetry).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event_type: 'PAYMENT_FAILED',
            metadata: expect.objectContaining({
              reason: 'UNDERPAYMENT',
            }),
          }),
        })
      );
    });

    it('should detect moderate underpayment (1-10%) and allow retry', async () => {
      const mockCreate = prisma.payment_events.create as jest.Mock;
      mockCreate.mockResolvedValue({});

      const result = await handleUnderpayment(
        'link-123',
        100,
        95,
        'USDC'
      );

      expect(result.shortfall).toBeCloseTo(5);
      expect(result.shortfallPercent).toBeCloseTo(5);
      expect(result.suggestedAction).toBe('retry');
      expect(result.canRetry).toBe(true);
      expect(result.message).toContain('5.00%');
    });

    it('should detect large underpayment (>10%) and suggest support contact', async () => {
      const mockCreate = prisma.payment_events.create as jest.Mock;
      mockCreate.mockResolvedValue({});

      const result = await handleUnderpayment(
        'link-123',
        100,
        80,
        'USDT'
      );

      expect(result.shortfall).toBeCloseTo(20);
      expect(result.shortfallPercent).toBeCloseTo(20);
      expect(result.suggestedAction).toBe('contact_support');
      expect(result.canRetry).toBe(true);
      expect(result.message).toContain('contact support');
    });
  });

  // ========================================================================
  // Overpayment Handling
  // ========================================================================

  describe('handleOverpayment', () => {
    it('should accept small overpayment (<1%)', async () => {
      const mockCreate = prisma.payment_events.create as jest.Mock;
      mockCreate.mockResolvedValue({});

      const result = await handleOverpayment(
        'link-123',
        100,
        100.5,
        'HBAR'
      );

      expect(result.excess).toBeCloseTo(0.5);
      expect(result.excessPercent).toBeCloseTo(0.5);
      expect(result.isAcceptable).toBe(true);
      expect(result.requiresReview).toBe(false);
      expect(result.message).toContain('normal');
    });

    it('should accept moderate overpayment (1-10%) but flag for review', async () => {
      const mockCreate = prisma.payment_events.create as jest.Mock;
      mockCreate.mockResolvedValue({});

      const result = await handleOverpayment(
        'link-123',
        100,
        107,
        'USDC'
      );

      expect(result.excess).toBeCloseTo(7);
      expect(result.excessPercent).toBeCloseTo(7);
      expect(result.isAcceptable).toBe(true);
      expect(result.requiresReview).toBe(false);
    });

    it('should flag large overpayment (10-20%) for manual review', async () => {
      const mockCreate = prisma.payment_events.create as jest.Mock;
      mockCreate.mockResolvedValue({});

      const result = await handleOverpayment(
        'link-123',
        100,
        115,
        'USDT'
      );

      expect(result.excess).toBeCloseTo(15);
      expect(result.excessPercent).toBeCloseTo(15);
      expect(result.isAcceptable).toBe(true);
      expect(result.requiresReview).toBe(true);
      expect(result.message).toContain('manual review');
    });

    it('should flag very large overpayment (>20%) as unusual', async () => {
      const mockCreate = prisma.payment_events.create as jest.Mock;
      mockCreate.mockResolvedValue({});

      const result = await handleOverpayment(
        'link-123',
        100,
        125,
        'AUDD'
      );

      expect(result.excess).toBeCloseTo(25);
      expect(result.excessPercent).toBeCloseTo(25);
      expect(result.isAcceptable).toBe(true);
      expect(result.requiresReview).toBe(true);
      expect(result.message).toContain('unusual');
    });
  });

  // ========================================================================
  // Duplicate Payment Detection
  // ========================================================================

  describe('checkDuplicatePayment', () => {
    it('should detect duplicate Stripe payment', async () => {
      const mockFindFirst = prisma.payment_events.findFirst as jest.Mock;
      mockFindFirst.mockResolvedValue({
        id: 'event-123',
        created_at: new Date('2024-01-15T10:00:00Z'),
        amount_received: 100,
      });

      const result = await checkDuplicatePayment(
        'link-123',
        'pi_abc123',
        'STRIPE'
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.existingTransactionId).toBe('pi_abc123');
      expect(result.existingPaymentEventId).toBe('event-123');
      expect(result.message).toContain('already been processed');
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: {
          payment_link_id: 'link-123',
          event_type: 'PAYMENT_CONFIRMED',
          stripe_payment_intent_id: 'pi_abc123',
        },
        select: expect.any(Object),
      });
    });

    it('should detect duplicate Hedera payment', async () => {
      const mockFindFirst = prisma.payment_events.findFirst as jest.Mock;
      mockFindFirst.mockResolvedValue({
        id: 'event-456',
        created_at: new Date('2024-01-15T10:00:00Z'),
        amount_received: 100,
      });

      const result = await checkDuplicatePayment(
        'link-456',
        '0.0.123@1234567890.000000000',
        'HEDERA'
      );

      expect(result.isDuplicate).toBe(true);
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: {
          payment_link_id: 'link-456',
          event_type: 'PAYMENT_CONFIRMED',
          hedera_transaction_id: '0.0.123@1234567890.000000000',
        },
        select: expect.any(Object),
      });
    });

    it('should return not duplicate for new payment', async () => {
      const mockFindFirst = prisma.payment_events.findFirst as jest.Mock;
      mockFindFirst.mockResolvedValue(null);

      const result = await checkDuplicatePayment(
        'link-789',
        'pi_new123',
        'STRIPE'
      );

      expect(result.isDuplicate).toBe(false);
      expect(result.existingTransactionId).toBeUndefined();
    });
  });

  // ========================================================================
  // Payment Attempt Validation
  // ========================================================================

  describe('validatePaymentAttempt', () => {
    it('should allow payment on OPEN link', async () => {
      const mockFindUnique = prisma.payment_links.findUnique as jest.Mock;
      mockFindUnique.mockResolvedValue({
        id: 'link-123',
        status: 'OPEN',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      });

      const result = await validatePaymentAttempt('link-123', false);

      expect(result.allowed).toBe(true);
      expect(result.currentStatus).toBe('OPEN');
    });

    it('should reject payment on already PAID link', async () => {
      const mockFindUnique = prisma.payment_links.findUnique as jest.Mock;
      mockFindUnique.mockResolvedValue({
        id: 'link-123',
        status: 'PAID',
        expires_at: null,
      });

      const result = await validatePaymentAttempt('link-123', false);

      expect(result.allowed).toBe(false);
      expect(result.currentStatus).toBe('PAID');
      expect(result.reason).toContain('already been paid');
    });

    it('should reject payment on CANCELED link', async () => {
      const mockFindUnique = prisma.payment_links.findUnique as jest.Mock;
      mockFindUnique.mockResolvedValue({
        id: 'link-123',
        status: 'CANCELED',
        expires_at: null,
      });

      const result = await validatePaymentAttempt('link-123', false);

      expect(result.allowed).toBe(false);
      expect(result.currentStatus).toBe('CANCELED');
      expect(result.reason).toContain('canceled');
    });

    it('should reject and update EXPIRED link', async () => {
      const mockFindUnique = prisma.payment_links.findUnique as jest.Mock;
      const mockUpdate = prisma.payment_links.update as jest.Mock;
      
      mockFindUnique.mockResolvedValue({
        id: 'link-123',
        status: 'OPEN',
        expires_at: new Date(Date.now() - 1000), // 1 second ago
      });
      mockUpdate.mockResolvedValue({});

      const result = await validatePaymentAttempt('link-123', false);

      expect(result.allowed).toBe(false);
      expect(result.currentStatus).toBe('EXPIRED');
      expect(result.reason).toContain('expired');
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'link-123' },
        data: { status: 'EXPIRED', updated_at: expect.any(Date) },
      });
    });

    it('should return not found for non-existent link', async () => {
      const mockFindUnique = prisma.payment_links.findUnique as jest.Mock;
      mockFindUnique.mockResolvedValue(null);

      const result = await validatePaymentAttempt('link-nonexistent', false);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not found');
    });
  });

  // ========================================================================
  // Payment Lock (Concurrency Control)
  // ========================================================================

  describe('Payment Locking', () => {
    it('should acquire and release lock successfully', async () => {
      const mockQueryRaw = prisma.$queryRaw as jest.Mock;
      mockQueryRaw
        .mockResolvedValueOnce([{ pg_try_advisory_lock: true }])  // acquire
        .mockResolvedValueOnce([]);  // release

      const acquired = await acquirePaymentLock('link-123');
      expect(acquired).toBe(true);

      await releasePaymentLock('link-123');
      
      expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    });

    it('should fail to acquire lock if already held', async () => {
      const mockQueryRaw = prisma.$queryRaw as jest.Mock;
      mockQueryRaw.mockResolvedValue([{ pg_try_advisory_lock: false }]);

      const acquired = await acquirePaymentLock('link-123');
      expect(acquired).toBe(false);
    });

    it('should handle lock acquisition error gracefully', async () => {
      const mockQueryRaw = prisma.$queryRaw as jest.Mock;
      mockQueryRaw.mockRejectedValue(new Error('Database error'));

      const acquired = await acquirePaymentLock('link-123');
      expect(acquired).toBe(false);
    });
  });

  // ========================================================================
  // Expired Link Payment Handling
  // ========================================================================

  describe('handleExpiredLinkPayment', () => {
    it('should handle payment attempt on expired link', async () => {
      const mockFindUnique = prisma.payment_links.findUnique as jest.Mock;
      const mockCreate = prisma.payment_events.create as jest.Mock;
      
      const expiryDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      
      mockFindUnique.mockResolvedValue({
        id: 'link-123',
        amount: '100.00',
        currency: 'USD',
        description: 'Test payment',
        status: 'EXPIRED',
        expires_at: expiryDate,
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      });
      mockCreate.mockResolvedValue({});

      const result = await handleExpiredLinkPayment('link-123');

      expect(result.canRenew).toBe(true); // < 30 days old
      expect(result.message).toContain('expired');
      expect(result.originalLinkDetails).toEqual({
        amount: '100.00',
        currency: 'USD',
        description: 'Test payment',
      });
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          payment_link_id: 'link-123',
          event_type: 'PAYMENT_FAILED',
          metadata: expect.objectContaining({
            reason: 'LINK_EXPIRED',
          }),
        }),
      });
    });

    it('should not allow renewal for old expired link', async () => {
      const mockFindUnique = prisma.payment_links.findUnique as jest.Mock;
      const mockCreate = prisma.payment_events.create as jest.Mock;
      
      mockFindUnique.mockResolvedValue({
        id: 'link-456',
        amount: '50.00',
        currency: 'EUR',
        description: null,
        status: 'EXPIRED',
        expires_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
        created_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days ago
      });
      mockCreate.mockResolvedValue({});

      const result = await handleExpiredLinkPayment('link-456');

      expect(result.canRenew).toBe(false); // > 30 days old
    });

    it('should handle non-existent link', async () => {
      const mockFindUnique = prisma.payment_links.findUnique as jest.Mock;
      mockFindUnique.mockResolvedValue(null);

      const result = await handleExpiredLinkPayment('link-nonexistent');

      expect(result.canRenew).toBe(false);
      expect(result.message).toContain('not found');
    });
  });
});







