/**
 * Payment Link State Machine
 * Manages lifecycle state transitions and validation
 * 
 * State Flow:
 * DRAFT → OPEN → PAID
 *          ↓      ↓
 *       EXPIRED  CANCELED
 */

import { PaymentLinkStatus } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { log } from '@/lib/logger';

/**
 * Valid state transitions map
 */
const VALID_TRANSITIONS: Record<PaymentLinkStatus, PaymentLinkStatus[]> = {
  DRAFT: ['OPEN', 'CANCELED'],
  OPEN: ['PAID', 'EXPIRED', 'CANCELED'],
  PAID: [], // Terminal state - no transitions allowed
  EXPIRED: [], // Terminal state - no transitions allowed
  CANCELED: [], // Terminal state - no transitions allowed
};

/**
 * Checks if a state transition is valid
 * @param currentStatus Current payment link status
 * @param newStatus Desired new status
 * @returns boolean True if transition is valid
 */
export const isValidTransition = (
  currentStatus: PaymentLinkStatus,
  newStatus: PaymentLinkStatus
): boolean => {
  return VALID_TRANSITIONS[currentStatus]?.includes(newStatus) || false;
};

/**
 * Gets all valid next states for a given status
 * @param currentStatus Current payment link status
 * @returns Array of valid next states
 */
export const getValidNextStates = (
  currentStatus: PaymentLinkStatus
): PaymentLinkStatus[] => {
  return VALID_TRANSITIONS[currentStatus] || [];
};

/**
 * Checks if a status is a terminal state (no further transitions)
 * @param status Payment link status
 * @returns boolean True if terminal state
 */
export const isTerminalState = (status: PaymentLinkStatus): boolean => {
  return VALID_TRANSITIONS[status]?.length === 0;
};

/**
 * Transition a payment link to a new status with validation
 * @param paymentLinkId Payment link UUID
 * @param newStatus Desired new status
 * @param userId User ID making the change (for audit)
 * @returns Updated payment link
 * @throws Error if transition is invalid
 */
export const transitionPaymentLinkStatus = async (
  paymentLinkId: string,
  newStatus: PaymentLinkStatus,
  userId?: string
) => {
  // Get current payment link
  const paymentLink = await prisma.payment_links.findUnique({
    where: { id: paymentLinkId },
    select: {
      id: true,
      status: true,
      organization_id: true,
      short_code: true,
      invoice_reference: true,
    },
  });

  if (!paymentLink) {
    throw new Error('Payment link not found');
  }

  // Check if already in desired state
  if (paymentLink.status === newStatus) {
    log.debug({ paymentLinkId, status: newStatus }, 'Payment link already in desired state');
    return paymentLink;
  }

  // Validate transition
  if (!isValidTransition(paymentLink.status, newStatus)) {
    throw new Error(
      `Invalid state transition from ${paymentLink.status} to ${newStatus}`
    );
  }

  // Perform transition
  const updatedPaymentLink = await prisma.$transaction(async (tx) => {
    // Update payment link status
    const updated = await tx.payment_links.update({
      where: { id: paymentLinkId },
      data: {
        status: newStatus,
        updated_at: new Date(),
      },
    });

    // Create payment event for status change
    const eventTypeMap: Record<PaymentLinkStatus, string> = {
      DRAFT: 'CREATED',
      OPEN: 'OPENED',
      PAID: 'PAYMENT_CONFIRMED',
      EXPIRED: 'EXPIRED',
      CANCELED: 'CANCELED',
    };

    await tx.payment_events.create({
      data: {
        payment_link_id: paymentLinkId,
        event_type: eventTypeMap[newStatus] as any,
        metadata: {
          previousStatus: paymentLink.status,
          newStatus,
          triggeredBy: userId || 'system',
        },
      },
    });

    // Create audit log
    await tx.audit_logs.create({
      data: {
        organization_id: paymentLink.organization_id,
        user_id: userId || null,
        entity_type: 'PaymentLink',
        entity_id: paymentLinkId,
        action: 'STATUS_CHANGE',
        old_values: { status: paymentLink.status },
        new_values: { status: newStatus },
      },
    });

    return updated;
  });

  log.info(
    {
      paymentLinkId,
      shortCode: paymentLink.short_code,
      from: paymentLink.status,
      to: newStatus,
    },
    'Payment link status transition'
  );

  return updatedPaymentLink;
};

/**
 * Checks if payment link is expired and updates status if needed
 * @param paymentLinkId Payment link UUID
 * @returns Updated payment link or null if not expired
 */
export const checkAndUpdateExpiredStatus = async (paymentLinkId: string) => {
  const paymentLink = await prisma.payment_links.findUnique({
    where: { id: paymentLinkId },
    select: {
      id: true,
      status: true,
      expires_at: true,
    },
  });

  if (!paymentLink) {
    return null;
  }

  // Only check if in OPEN status and has expiry date
  if (paymentLink.status !== 'OPEN' || !paymentLink.expires_at) {
    return null;
  }

  // Check if expired
  const now = new Date();
  if (paymentLink.expires_at <= now) {
    return await transitionPaymentLinkStatus(paymentLinkId, 'EXPIRED', 'system');
  }

  return null;
};

/**
 * Batch check and update expired payment links
 * Should be run as a background job
 * @returns Number of payment links updated
 */
export const batchUpdateExpiredLinks = async (): Promise<number> => {
  const now = new Date();

  // Find all OPEN payment links that are expired
  const expiredLinks = await prisma.payment_links.findMany({
    where: {
      status: 'OPEN',
      expires_at: {
        lte: now,
      },
    },
    select: {
      id: true,
      short_code: true,
    },
  });

  let updatedCount = 0;

  // Update each expired link
  for (const link of expiredLinks) {
    try {
      await transitionPaymentLinkStatus(link.id, 'EXPIRED', 'system');
      updatedCount++;
    } catch (error) {
      log.error(
        { paymentLinkId: link.id, shortCode: link.short_code, error },
        'Failed to update expired payment link'
      );
    }
  }

  log.info(
    { total: expiredLinks.length, updated: updatedCount },
    'Batch updated expired payment links'
  );

  return updatedCount;
};

/**
 * Check if payment link can be edited
 * @param status Current payment link status
 * @returns boolean True if editable
 */
export const isPaymentLinkEditable = (status: PaymentLinkStatus): boolean => {
  return status === 'DRAFT';
};

/**
 * Check if payment link can be canceled
 * @param status Current payment link status
 * @returns boolean True if cancelable
 */
export const isPaymentLinkCancelable = (status: PaymentLinkStatus): boolean => {
  return ['DRAFT', 'OPEN'].includes(status);
};




