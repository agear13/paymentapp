/**
 * Payment Edge Case Handler
 * 
 * Centralized service for handling payment edge cases including:
 * - Underpayment resolution
 * - Overpayment tracking
 * - Duplicate payment detection
 * - Expired link payment attempts
 * - Concurrent payment handling (race conditions)
 */

import { log } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import type { PaymentLinkStatus } from '@prisma/client';

// ============================================================================
// Type Definitions
// ============================================================================

export interface UnderpaymentResult {
  canRetry: boolean;
  shortfall: number;
  shortfallPercent: number;
  message: string;
  suggestedAction: 'retry' | 'contact_support' | 'manual_review';
}

export interface OverpaymentResult {
  isAcceptable: boolean;
  excess: number;
  excessPercent: number;
  message: string;
  requiresReview: boolean; // True if excess > 10%
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingTransactionId?: string;
  existingPaymentEventId?: string;
  message?: string;
}

export interface PaymentAttemptResult {
  allowed: boolean;
  reason?: string;
  currentStatus: PaymentLinkStatus;
  suggestedAction?: string;
}

// ============================================================================
// Underpayment Handling
// ============================================================================

/**
 * Handle underpayment scenario
 * 
 * Determines if a retry is possible and provides guidance to the customer
 */
export async function handleUnderpayment(
  paymentLinkId: string,
  requiredAmount: number,
  receivedAmount: number,
  tokenType: string
): Promise<UnderpaymentResult> {
  const shortfall = requiredAmount - receivedAmount;
  const shortfallPercent = (shortfall / requiredAmount) * 100;

  log.warn(
    {
      paymentLinkId,
      requiredAmount,
      receivedAmount,
      shortfall,
      shortfallPercent,
      tokenType,
    },
    'Underpayment detected'
  );

  // Create underpayment event
  await prisma.payment_events.create({
    data: {
      payment_link_id: paymentLinkId,
      event_type: 'PAYMENT_FAILED',
      payment_method: 'HEDERA',
      amount_received: receivedAmount,
      metadata: {
        reason: 'UNDERPAYMENT',
        requiredAmount,
        receivedAmount,
        shortfall,
        shortfallPercent,
        tokenType,
        timestamp: new Date().toISOString(),
      },
    },
  });

  // Determine suggested action based on shortfall percentage
  let suggestedAction: 'retry' | 'contact_support' | 'manual_review';
  let canRetry = true;
  let message: string;

  if (shortfallPercent < 1) {
    // Less than 1% short - likely rounding/fee issue
    suggestedAction = 'manual_review';
    message = `Payment was ${shortfallPercent.toFixed(4)}% short. This will be reviewed manually.`;
  } else if (shortfallPercent < 10) {
    // 1-10% short - allow retry
    suggestedAction = 'retry';
    message = `Payment was ${shortfallPercent.toFixed(2)}% short. Please send an additional ${shortfall.toFixed(8)} ${tokenType}.`;
  } else {
    // >10% short - requires support contact
    suggestedAction = 'contact_support';
    message = `Payment was significantly short (${shortfallPercent.toFixed(2)}%). Please contact support for assistance.`;
  }

  return {
    canRetry,
    shortfall,
    shortfallPercent,
    message,
    suggestedAction,
  };
}

// ============================================================================
// Overpayment Handling
// ============================================================================

/**
 * Handle overpayment scenario
 * 
 * Determines if overpayment is acceptable or requires review
 */
export async function handleOverpayment(
  paymentLinkId: string,
  requiredAmount: number,
  receivedAmount: number,
  tokenType: string
): Promise<OverpaymentResult> {
  const excess = receivedAmount - requiredAmount;
  const excessPercent = (excess / requiredAmount) * 100;
  const requiresReview = excessPercent > 10; // Flag if >10% overpayment

  log.info(
    {
      paymentLinkId,
      requiredAmount,
      receivedAmount,
      excess,
      excessPercent,
      tokenType,
      requiresReview,
    },
    'Overpayment detected'
  );

  // Create overpayment tracking event
  await prisma.payment_events.create({
    data: {
      payment_link_id: paymentLinkId,
      event_type: 'PAYMENT_CONFIRMED',
      payment_method: 'HEDERA',
      amount_received: receivedAmount,
      metadata: {
        variance: 'OVERPAYMENT',
        requiredAmount,
        receivedAmount,
        excess,
        excessPercent,
        tokenType,
        requiresReview,
        timestamp: new Date().toISOString(),
      },
    },
  });

  let message: string;
  const isAcceptable = excessPercent <= 20; // Accept up to 20% overpayment

  if (excessPercent < 1) {
    message = `Payment received with ${excessPercent.toFixed(4)}% excess. This is normal and has been accepted.`;
  } else if (excessPercent <= 10) {
    message = `Payment received with ${excessPercent.toFixed(2)}% excess. This has been accepted and will be processed normally.`;
  } else if (excessPercent <= 20) {
    message = `Payment received with ${excessPercent.toFixed(2)}% excess. This requires manual review but will be processed.`;
  } else {
    message = `Payment received with ${excessPercent.toFixed(2)}% excess. This is unusual and requires manual investigation.`;
  }

  return {
    isAcceptable,
    excess,
    excessPercent,
    message,
    requiresReview,
  };
}

// ============================================================================
// Duplicate Payment Detection
// ============================================================================

/**
 * Check for duplicate payment
 * 
 * Prevents processing the same transaction multiple times
 */
export async function checkDuplicatePayment(
  paymentLinkId: string,
  transactionId: string,
  paymentMethod: 'STRIPE' | 'HEDERA'
): Promise<DuplicateCheckResult> {
  log.debug(
    { paymentLinkId, transactionId, paymentMethod },
    'Checking for duplicate payment'
  );

  const whereClause = paymentMethod === 'STRIPE'
    ? { stripe_payment_intent_id: transactionId }
    : { hedera_transaction_id: transactionId };

  const existingEvent = await prisma.payment_events.findFirst({
    where: {
      payment_link_id: paymentLinkId,
      event_type: 'PAYMENT_CONFIRMED',
      ...whereClause,
    },
    select: {
      id: true,
      created_at: true,
      amount_received: true,
    },
  });

  if (existingEvent) {
    log.warn(
      {
        paymentLinkId,
        transactionId,
        existingPaymentEventId: existingEvent.id,
        existingPaymentDate: existingEvent.created_at,
      },
      'Duplicate payment detected'
    );

    return {
      isDuplicate: true,
      existingTransactionId: transactionId,
      existingPaymentEventId: existingEvent.id,
      message: `This ${paymentMethod} payment has already been processed at ${existingEvent.created_at.toISOString()}`,
    };
  }

  return { isDuplicate: false };
}

// ============================================================================
// Payment Attempt Validation
// ============================================================================

/**
 * Validate if payment can be attempted on link
 * 
 * Checks link status, expiry, and prevents race conditions
 */
export async function validatePaymentAttempt(
  paymentLinkId: string,
  useOptimisticLock: boolean = true
): Promise<PaymentAttemptResult> {
  // Use SELECT FOR UPDATE to prevent race conditions
  const paymentLink = useOptimisticLock
    ? await prisma.$queryRaw<Array<{
        id: string;
        status: PaymentLinkStatus;
        expires_at: Date | null;
      }>>`
        SELECT id, status, expires_at
        FROM payment_links
        WHERE id = ${paymentLinkId}::uuid
        FOR UPDATE NOWAIT
      `
    : await prisma.payment_links.findUnique({
        where: { id: paymentLinkId },
        select: { id: true, status: true, expires_at: true },
      });

  if (!paymentLink || (Array.isArray(paymentLink) && paymentLink.length === 0)) {
    return {
      allowed: false,
      reason: 'Payment link not found',
      currentStatus: 'CANCELED',
      suggestedAction: 'Contact merchant for a new payment link',
    };
  }

  const link = Array.isArray(paymentLink) ? paymentLink[0] : paymentLink;

  // Check if already paid
  if (link.status === 'PAID') {
    log.warn({ paymentLinkId }, 'Payment attempt on already paid link');
    return {
      allowed: false,
      reason: 'This payment link has already been paid',
      currentStatus: link.status,
      suggestedAction: 'Contact merchant if you believe this is an error',
    };
  }

  // Check if canceled
  if (link.status === 'CANCELED') {
    log.warn({ paymentLinkId }, 'Payment attempt on canceled link');
    return {
      allowed: false,
      reason: 'This payment link has been canceled',
      currentStatus: link.status,
      suggestedAction: 'Request a new payment link from the merchant',
    };
  }

  // Check if expired
  if (link.status === 'EXPIRED' || (link.expires_at && link.expires_at < new Date())) {
    log.warn({ paymentLinkId, expiresAt: link.expires_at }, 'Payment attempt on expired link');
    
    // Auto-transition to EXPIRED if not already
    if (link.status !== 'EXPIRED') {
      await prisma.payment_links.update({
        where: { id: paymentLinkId },
        data: { status: 'EXPIRED', updated_at: new Date() },
      });
    }

    return {
      allowed: false,
      reason: 'This payment link has expired',
      currentStatus: 'EXPIRED',
      suggestedAction: 'Request a new payment link from the merchant',
    };
  }

  // Payment allowed
  return {
    allowed: true,
    currentStatus: link.status,
  };
}

// ============================================================================
// Concurrent Payment Protection
// ============================================================================

/**
 * Acquire lock for payment processing
 * 
 * Prevents race conditions when multiple payment confirmations arrive
 * Uses PostgreSQL advisory locks
 */
export async function acquirePaymentLock(
  paymentLinkId: string,
  timeoutMs: number = 5000
): Promise<boolean> {
  // Convert UUID to bigint for advisory lock
  // We'll use a hash of the UUID string
  const lockId = hashUuidToBigInt(paymentLinkId);

  try {
    const result = await prisma.$queryRaw<Array<{ pg_try_advisory_lock: boolean }>>`
      SELECT pg_try_advisory_lock(${lockId})
    `;

    const acquired = result[0]?.pg_try_advisory_lock || false;

    if (acquired) {
      log.debug({ paymentLinkId, lockId }, 'Payment lock acquired');
    } else {
      log.warn({ paymentLinkId, lockId }, 'Failed to acquire payment lock');
    }

    return acquired;
  } catch (error) {
    log.error({ error, paymentLinkId }, 'Error acquiring payment lock');
    return false;
  }
}

/**
 * Release payment processing lock
 */
export async function releasePaymentLock(paymentLinkId: string): Promise<void> {
  const lockId = hashUuidToBigInt(paymentLinkId);

  try {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${lockId})`;
    log.debug({ paymentLinkId, lockId }, 'Payment lock released');
  } catch (error) {
    log.error({ error, paymentLinkId }, 'Error releasing payment lock');
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Hash UUID to bigint for advisory locks
 * Simple hash function for demonstration
 */
function hashUuidToBigInt(uuid: string): bigint {
  // Remove hyphens and take first 16 hex chars
  const hex = uuid.replace(/-/g, '').substring(0, 16);
  return BigInt('0x' + hex);
}

// ============================================================================
// Expired Link Payment Handler
// ============================================================================

/**
 * Handle payment attempt on expired link
 * 
 * Provides clear messaging and optional link renewal
 */
export async function handleExpiredLinkPayment(
  paymentLinkId: string
): Promise<{
  message: string;
  canRenew: boolean;
  originalLinkDetails?: {
    amount: string;
    currency: string;
    description: string | null;
  };
}> {
  const paymentLink = await prisma.payment_links.findUnique({
    where: { id: paymentLinkId },
    select: {
      id: true,
      amount: true,
      currency: true,
      description: true,
      status: true,
      expires_at: true,
      created_at: true,
    },
  });

  if (!paymentLink) {
    return {
      message: 'Payment link not found',
      canRenew: false,
    };
  }

  // Log the attempt
  await prisma.payment_events.create({
    data: {
      payment_link_id: paymentLinkId,
      event_type: 'PAYMENT_FAILED',
      metadata: {
        reason: 'LINK_EXPIRED',
        attemptedAt: new Date().toISOString(),
        expiresAt: paymentLink.expires_at?.toISOString(),
      },
    },
  });

  log.info(
    { paymentLinkId, expiresAt: paymentLink.expires_at },
    'Payment attempt on expired link'
  );

  // Check if link was recently created (< 30 days) - can suggest renewal
  const ageInDays = (Date.now() - paymentLink.created_at.getTime()) / (1000 * 60 * 60 * 24);
  const canRenew = ageInDays < 30;

  return {
    message: `This payment link expired ${paymentLink.expires_at ? 'on ' + paymentLink.expires_at.toISOString() : 'previously'}. Please request a new link from the merchant.`,
    canRenew,
    originalLinkDetails: {
      amount: paymentLink.amount.toString(),
      currency: paymentLink.currency,
      description: paymentLink.description,
    },
  };
}

// ============================================================================
// Partial Payment Handler (Future Enhancement)
// ============================================================================

/**
 * Handle partial payment scenario
 * 
 * Note: Not currently supported but structure in place for future
 */
export async function recordPartialPayment(
  paymentLinkId: string,
  amountReceived: number,
  tokenType: string,
  transactionId: string
): Promise<void> {
  log.info(
    { paymentLinkId, amountReceived, tokenType },
    'Recording partial payment (not yet supported)'
  );

  await prisma.payment_events.create({
    data: {
      payment_link_id: paymentLinkId,
      event_type: 'PAYMENT_FAILED',
      payment_method: 'HEDERA',
      hedera_transaction_id: transactionId,
      amount_received: amountReceived,
      metadata: {
        reason: 'PARTIAL_PAYMENT_NOT_SUPPORTED',
        tokenType,
        note: 'Partial payments are not currently supported. Full amount required.',
        timestamp: new Date().toISOString(),
      },
    },
  });
}







