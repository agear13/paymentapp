/**
 * Payment Link Status Transition API
 * POST /api/payment-links/[id]/status - Transition payment link status
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { loggers } from '@/lib/logger';
import { requireAuth } from '@/lib/auth/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';
import { PaymentLinkStatusSchema } from '@/lib/validations/schemas';
import { 
  transitionPaymentLinkStatus,
  isValidTransition,
  getValidNextStates,
} from '@/lib/payment-link-state-machine';
import { prisma } from '@/lib/prisma';

const StatusTransitionSchema = z.object({
  status: PaymentLinkStatusSchema,
});

/**
 * POST /api/payment-links/[id]/status
 * Transition payment link to new status
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Rate limiting
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Authentication
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Get current payment link
    const currentLink = await prisma.payment_links.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        status: true,
      },
    });

    if (!currentLink) {
      return NextResponse.json(
        { error: 'Payment link not found' },
        { status: 404 }
      );
    }

    // Check permission
    const canEdit = await checkUserPermission(
      user.id,
      currentLink.organizationId,
      'edit_payment_links'
    );
    if (!canEdit) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const { status: newStatus } = StatusTransitionSchema.parse(body);

    // Validate transition
    if (!isValidTransition(currentLink.status, newStatus)) {
      const validStates = getValidNextStates(currentLink.status);
      return NextResponse.json(
        {
          error: `Invalid status transition from ${currentLink.status} to ${newStatus}`,
          validTransitions: validStates,
        },
        { status: 400 }
      );
    }

    // Perform transition
    const updatedLink = await transitionPaymentLinkStatus(
      id,
      newStatus,
      user.id
    );

    log.payment.info(
      {
        paymentLinkId: id,
        from: currentLink.status,
        to: newStatus,
        userId: user.id,
      },
      'Payment link status transitioned'
    );

    return NextResponse.json({
      data: updatedLink,
      message: `Payment link transitioned to ${newStatus}`,
    });
  } catch (error: any) {
    loggers.api.error(
      { error: error.message, paymentLinkId: params.id },
      'Failed to transition payment link status'
    );

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/payment-links/[id]/status
 * Get current status and valid transitions
 * Enhanced for polling with comprehensive status information
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // More lenient rate limiting for polling (higher limit)
    const rateLimitResult = await applyRateLimit(request, 'polling');
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const { id } = params;

    // Get payment link with comprehensive data for status polling
    const paymentLink = await prisma.payment_links.findUnique({
      where: { id },
      select: {
        id: true,
        short_code: true,
        status: true,
        amount: true,
        currency: true,
        expires_at: true,
        created_at: true,
        updated_at: true,
        payment_events: {
          orderBy: { created_at: 'desc' },
          take: 5,
          select: {
            id: true,
            event_type: true,
            payment_method: true,
            created_at: true,
            metadata: true,
          },
        },
      },
    });

    if (!paymentLink) {
      return NextResponse.json(
        { error: 'Payment link not found' },
        { status: 404 }
      );
    }

    // Check if link has expired
    const isExpired = paymentLink.expires_at && new Date(paymentLink.expires_at) < new Date();
    let currentStatus = paymentLink.status;

    // Auto-transition to EXPIRED if needed
    if (isExpired && currentStatus === 'OPEN') {
      await prisma.$transaction([
        prisma.payment_links.update({
          where: { id },
          data: { status: 'EXPIRED', updated_at: new Date() },
        }),
        prisma.payment_events.create({
          data: {
            payment_link_id: id,
            event_type: 'EXPIRED',
            metadata: { 
              expiredAt: new Date().toISOString(),
              autoExpired: true,
            },
          },
        }),
      ]);
      currentStatus = 'EXPIRED';
    }

    const lastEvent = paymentLink.payment_events[0];
    const validTransitions = getValidNextStates(currentStatus);

    // Build transaction information if available
    let transactionInfo = null;
    if (lastEvent?.metadata) {
      const metadata = lastEvent.metadata as any;
      if (metadata.transactionId || metadata.stripePaymentIntentId) {
        transactionInfo = {
          transactionId: metadata.transactionId || metadata.stripePaymentIntentId,
          paymentMethod: lastEvent.payment_method,
          timestamp: lastEvent.created_at,
          amount: metadata.amount,
          currency: metadata.currency,
        };
      }
    }

    // Generate human-readable status message
    const statusMessage = generateStatusMessage(currentStatus, lastEvent);

    return NextResponse.json({
      data: {
        id: paymentLink.id,
        shortCode: paymentLink.short_code,
        currentStatus,
        statusMessage,
        lastEventType: lastEvent?.event_type || null,
        lastEventTimestamp: lastEvent?.created_at || null,
        paymentMethod: lastEvent?.payment_method || null,
        validTransitions,
        transactionInfo,
        expiresAt: paymentLink.expires_at,
        isExpired,
        updatedAt: paymentLink.updated_at,
      },
    });
  } catch (error: any) {
    loggers.api.error(
      { error: error.message, paymentLinkId: params.id },
      'Failed to get payment link status'
    );
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Generate human-readable status messages
 */
function generateStatusMessage(status: string, lastEvent?: any): string {
  switch (status) {
    case 'DRAFT':
      return 'Payment link is in draft mode';
    case 'OPEN':
      return 'Awaiting payment';
    case 'PAID':
      const method = lastEvent?.payment_method;
      return method 
        ? `Payment completed via ${method === 'STRIPE' ? 'Card' : 'Crypto'}`
        : 'Payment completed';
    case 'EXPIRED':
      return 'Payment link has expired';
    case 'CANCELED':
      return 'Payment link has been canceled';
    default:
      return 'Unknown status';
  }
}




