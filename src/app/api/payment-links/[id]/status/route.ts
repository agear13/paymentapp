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
import { prisma } from '@/lib/server/prisma';

const StatusTransitionSchema = z.object({
  status: PaymentLinkStatusSchema,
});

/**
 * POST /api/payment-links/[id]/status
 * Transition payment link to new status
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let id: string | undefined;
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

    // Next.js 15: await params
    const p = await params;
    id = p.id;

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

    loggers.payment.info(
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
      { error: error.message, paymentLinkId: id },
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
 * DB-only endpoint for fast polling (no mirror node queries)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isDev = process.env.NODE_ENV !== 'production';
  let id: string | undefined;
  
  try {
    // More lenient rate limiting for polling (higher limit)
    const rateLimitResult = await applyRateLimit(request, 'polling');

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Next.js 15: await params
    const p = await params;
    id = p.id;

    // Validate UUID format (basic check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid payment link id' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

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
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
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
      if (isDev) {
        loggers.api.info({ paymentLinkId: id }, 'Auto-expired payment link');
      }
      currentStatus = 'EXPIRED';
    }

    const lastEvent = paymentLink.payment_events[0];
    const validTransitions = getValidNextStates(currentStatus);

    let transactionInfo = null;
    const txId =
      lastEvent?.stripe_payment_intent_id ||
      lastEvent?.hedera_transaction_id ||
      lastEvent?.wise_transfer_id ||
      (lastEvent?.metadata && typeof lastEvent.metadata === 'object' && (lastEvent.metadata as Record<string, unknown>).transactionId as string);
    if (txId) {
      const metadata = (lastEvent?.metadata as Record<string, unknown>) || {};
      transactionInfo = {
        transactionId: txId,
        paymentMethod: lastEvent?.payment_method,
        timestamp: lastEvent?.created_at,
        amount: metadata.amount ?? (lastEvent?.amount_received?.toString()),
        currency: metadata.currency ?? lastEvent?.currency_received,
      };
    }

    // Generate human-readable status message
    const statusMessage = generateStatusMessage(currentStatus, lastEvent);

    return NextResponse.json(
      {
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
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error: any) {
    // Always log errors
    loggers.api.error(
      { error: error.message, paymentLinkId: id },
      'Failed to get payment link status'
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
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




