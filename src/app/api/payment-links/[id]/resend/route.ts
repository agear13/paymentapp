/**
 * Payment Link Reminder Log API
 * POST /api/payment-links/[id]/resend - records a reminder/send activity event.
 * NOTE: This endpoint does not dispatch real email delivery yet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { apiResponse, apiError } from '@/lib/api/middleware';
import { logAudit } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Fetch the payment link
    const paymentLink = await prisma.payment_links.findUnique({
      where: { id },
      include: {
        organizations: true,
      },
    });

    if (!paymentLink) {
      return apiError('Payment link not found', 404);
    }

    // Validate link is in a state where notification makes sense
    if (
      paymentLink.status === 'PAID' ||
      paymentLink.status === 'PAID_UNVERIFIED' ||
      paymentLink.status === 'REQUIRES_REVIEW'
    ) {
      return apiError('Cannot resend notification for a paid or submitted invoice', 400);
    }

    if (paymentLink.status === 'CANCELED') {
      return apiError('Cannot resend notification for canceled link', 400);
    }

    if (paymentLink.status === 'EXPIRED') {
      return apiError('Cannot resend notification for expired link', 400);
    }

    // Check if customer email exists
    if (!paymentLink.customer_email) {
      return apiError('Customer email required to send invoice. Add an email address or copy the invoice link to share it manually.', 400);
    }

    // Current pilot behavior: log reminder/send intent for operator tracking.
    // Real email dispatch is not yet wired from this endpoint.
    await prisma.payment_events.create({
      data: {
        payment_link_id: id,
        event_type: 'NOTIFICATION_SENT',
        payment_method: null,
        metadata: {
          channel: 'email',
          recipient: paymentLink.customer_email,
          timestamp: new Date().toISOString(),
        },
      },
    });

    // Log audit trail
    logAudit({
      action: 'RESEND_NOTIFICATION',
      entityType: 'payment_link',
      entityId: id,
      organizationId: paymentLink.organization_id,
      details: {
        email: paymentLink.customer_email,
      },
    });

    return apiResponse({
      message: 'Reminder recorded. Share the invoice link manually.',
      data: {
        sent: false,
        mode: 'manual_share_required',
        recipient: paymentLink.customer_email,
      },
    });
  } catch (error: any) {
    console.error('Error resending notification:', error);
    return apiError(
      error.message || 'Failed to resend notification',
      500
    );
  }
}




